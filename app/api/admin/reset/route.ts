import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

const RESET_PHRASE = '우땅야구 기록 전체 초기화';

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
      env.DB.prepare('DELETE FROM scores'),
      env.DB.prepare('DELETE FROM game_sessions'),
      env.DB.prepare('DELETE FROM share_cards'),
      env.DB.prepare('DELETE FROM daily_stats'),
      env.DB.prepare('DELETE FROM daily_players'),
      env.DB.prepare('DELETE FROM funnel_events'),
      env.DB.prepare('DELETE FROM nickname_reports'),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, details, created_at) VALUES (?, ?, ?, ?)',
      ).bind(
        'RESET_ALL_RECORDS',
        'system',
        '사용자 경기·랭킹·통계·퍼널·신고 기록 전체 초기화',
        now,
      ),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    console.error(
      JSON.stringify({
        message: 'admin reset failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json(
      { error: '기록을 초기화하지 못했어.' },
      { status: 503 },
    );
  }
}
