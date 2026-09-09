import { env } from 'cloudflare:workers';
import {
  adminCookie,
  clearAdminCookie,
  constantTimeEqual,
  createAdminSession,
  isAdminRequest,
  requestIdentityHash,
} from '@/lib/admin-auth';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function GET(request: Request) {
  const authenticated =
    Boolean(env.ADMIN_SESSION_SECRET) &&
    (await isAdminRequest(request, env.ADMIN_SESSION_SECRET));
  return Response.json(
    { authenticated },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  try {
    const body = await readLimitedJson(request);
    const password = typeof body.password === 'string' ? body.password : '';
    const now = Date.now();
    const identityHash = await requestIdentityHash(request);
    const attempt = await env.DB.prepare(
      'SELECT attempts, window_started_at, blocked_until FROM admin_login_attempts WHERE identity_hash = ?',
    )
      .bind(identityHash)
      .first<{
        attempts: number;
        window_started_at: number;
        blocked_until: number;
      }>();
    if ((attempt?.blocked_until ?? 0) > now) {
      return Response.json(
        { error: '잠시 쉬었다가 다시 시도해줘.' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    }
    const valid =
      Boolean(env.ADMIN_PASSWORD) &&
      (await constantTimeEqual(password, env.ADMIN_PASSWORD));
    if (!valid) {
      const inWindow = attempt && now - attempt.window_started_at < WINDOW_MS;
      const attempts = inWindow ? attempt.attempts + 1 : 1;
      const blockedUntil = attempts >= MAX_ATTEMPTS ? now + WINDOW_MS : 0;
      await env.DB.prepare(
        `INSERT INTO admin_login_attempts(identity_hash, attempts, window_started_at, blocked_until)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(identity_hash) DO UPDATE SET attempts = excluded.attempts,
           window_started_at = excluded.window_started_at, blocked_until = excluded.blocked_until`,
      )
        .bind(
          identityHash,
          attempts,
          inWindow ? attempt.window_started_at : now,
          blockedUntil,
        )
        .run();
      return Response.json({ error: '암호가 맞지 않아.' }, { status: 401 });
    }
    const token = await createAdminSession(env.ADMIN_SESSION_SECRET, now);
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM admin_login_attempts WHERE identity_hash = ?',
      ).bind(identityHash),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, details, created_at) VALUES (?, ?, ?, ?)',
      ).bind('LOGIN', 'admin', '관리자 로그인', now),
    ]);
    return Response.json(
      { authenticated: true },
      {
        headers: {
          'Set-Cookie': adminCookie(token),
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    console.error(
      JSON.stringify({
        message: 'admin login failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json(
      { error: '로그인을 처리하지 못했어.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  void request;
  return Response.json(
    { authenticated: false },
    {
      headers: {
        'Set-Cookie': clearAdminCookie(),
        'Cache-Control': 'no-store',
      },
    },
  );
}
