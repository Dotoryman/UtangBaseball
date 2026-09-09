import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

const RESET_PHRASE = '오늘의 우땅왕 랭킹 전체 비우기';

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readLimitedJson(request);
    if (body.confirm !== RESET_PHRASE)
      return Response.json(
        { error: '확인 문구가 정확하지 않아.' },
        { status: 400 },
      );
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO admin_state(state_key, state_value, updated_at)
        VALUES ('ranking_cleared_at', ?, ?)
        ON CONFLICT(state_key) DO UPDATE SET
          state_value = excluded.state_value,
          updated_at = excluded.updated_at`).bind(now, now),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, details, created_at) VALUES (?, ?, ?, ?)',
      ).bind(
        'CLEAR_RANKINGS',
        'ranking',
        '기존 랭킹 기록 전체 비우기 (플레이 통계 보존)',
        now,
      ),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    console.error(
      JSON.stringify({
        message: 'admin ranking clear failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json({ error: '랭킹을 비우지 못했어.' }, { status: 503 });
  }
}
