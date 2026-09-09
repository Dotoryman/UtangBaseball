import { env } from 'cloudflare:workers';
import { funnelStatement, isFunnelEvent } from '@/lib/analytics';
import { koreanDayStart } from '@/lib/daily-bat';
import { playerIdentity } from '@/lib/player-session';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

export async function POST(request: Request) {
  try {
    const body = await readLimitedJson(request);
    if (!isFunnelEvent(body.event))
      return Response.json(
        { error: '잘못된 통계 이벤트입니다.' },
        { status: 400 },
      );
    const identity = playerIdentity(request);
    const now = Date.now();
    const statements = [
      funnelStatement(env.DB, identity.playerId, body.event, now),
    ];
    if (body.event === 'share_click' || body.event === 'referral') {
      const column =
        body.event === 'share_click' ? 'share_clicks' : 'referrals';
      statements.push(
        env.DB.prepare(`INSERT INTO daily_stats(day_start, ${column}) VALUES (?, 1)
        ON CONFLICT(day_start) DO UPDATE SET ${column} = ${column} + 1`).bind(
          koreanDayStart(now),
        ),
      );
    }
    await env.DB.batch(statements);
    return new Response(null, {
      status: 204,
      headers: identity.setCookie
        ? { 'Set-Cookie': identity.setCookie }
        : undefined,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    return new Response(null, { status: 204 });
  }
}
