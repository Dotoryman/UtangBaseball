import { env } from 'cloudflare:workers';

export const ADMIN_COOKIE_NAME = 'utang_admin';

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function sha256(value: string) {
  return crypto.subtle.digest('SHA-256', encoder.encode(value));
}

export async function constantTimeEqual(provided: string, expected: string) {
  const [left, right] = await Promise.all([sha256(provided), sha256(expected)]);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
  };
  return subtle.timingSafeEqual(left, right);
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64Url(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
    ),
  );
}

export async function createAdminSession(secret: string, now = Date.now()) {
  const expiresAt = now + 8 * 60 * 60 * 1000;
  const payload = `${expiresAt}.${crypto.randomUUID()}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function isAdminRequest(
  request: Request,
  secret: string,
  now = Date.now(),
) {
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return constantTimeEqual(parts[2], await sign(payload, secret));
}

export function adminCookie(token: string) {
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function requireAdmin(request: Request) {
  if (
    !env.ADMIN_SESSION_SECRET ||
    !(await isAdminRequest(request, env.ADMIN_SESSION_SECRET))
  ) {
    return Response.json(
      { error: '관리자 인증이 필요합니다.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return null;
}

export async function requestIdentityHash(request: Request) {
  const address = request.headers.get('cf-connecting-ip') ?? 'local';
  return bytesToBase64Url(
    new Uint8Array(await sha256(`${address}:${env.ADMIN_SESSION_SECRET}`)),
  );
}
