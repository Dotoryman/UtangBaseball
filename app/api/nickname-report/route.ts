import { env } from 'cloudflare:workers';
import { playerIdentity } from '@/lib/player-session';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

export async function POST(request: Request) {
  try {
    const body = await readLimitedJson(request);
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 10) : '';
    if (!nickname) return Response.json({ error: '신고할 닉네임이 없어.' }, { status: 400 });
    const exists = await env.DB.prepare('SELECT 1 found FROM scores WHERE nickname = ? LIMIT 1').bind(nickname).first();
    if (!exists) return Response.json({ error: '이미 사라진 기록이야.' }, { status: 404 });
    const identity = playerIdentity(request);
    const result = await env.DB.prepare(
      'INSERT OR IGNORE INTO nickname_reports(nickname, reporter_id, created_at) VALUES (?, ?, ?)',
    ).bind(nickname, identity.playerId, Date.now()).run();
    return Response.json(
      { ok: true, duplicate: !result.meta.changes },
      { headers: identity.setCookie ? { 'Set-Cookie': identity.setCookie } : undefined },
    );
  } catch (error) {
    if (error instanceof BodyTooLargeError) return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    return Response.json({ error: '신고를 받지 못했어.' }, { status: 503 });
  }
}
