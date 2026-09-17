import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { adminPeriod } from '@/lib/admin-period';

type Row = Record<string, number | string | null>;

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const period = adminPeriod(new URL(request.url));
  const { from, to } = period;
  try {
    const results = await env.DB.batch<Row>([
      env.DB.prepare(`SELECT
        COALESCE(SUM(completed_games), 0) completed_games,
        COALESCE(MAX(max_score), 0) max_score,
        COALESCE(SUM(home_runs), 0) home_runs,
        COALESCE(SUM(share_clicks), 0) share_clicks
        FROM daily_stats WHERE day_start >= ? AND day_start < ?`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT COUNT(*) users,
        COALESCE(AVG(games), 0) avg_plays,
        COALESCE(SUM(CASE WHEN games = 1 THEN 1 ELSE 0 END), 0) one_play,
        COALESCE(SUM(CASE WHEN games = 2 THEN 1 ELSE 0 END), 0) two_plays,
        COALESCE(SUM(CASE WHEN games = 3 THEN 1 ELSE 0 END), 0) three_plays,
        COALESCE(SUM(CASE WHEN games = 4 THEN 1 ELSE 0 END), 0) four_plays,
        COALESCE(SUM(CASE WHEN games >= 5 THEN 1 ELSE 0 END), 0) five_plus
        FROM (SELECT player_id, SUM(completed_games) games FROM daily_players
          WHERE day_start >= ? AND day_start < ? AND player_id != 'anonymous' GROUP BY player_id)`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT day_start day, completed_games plays FROM daily_stats
        WHERE day_start >= ? AND day_start < ? ORDER BY day_start`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT CAST(strftime('%H', played_at / 1000, 'unixepoch', '+9 hours') AS INTEGER) hour,
        COUNT(*) plays FROM scores WHERE played_at >= ? AND played_at < ? GROUP BY hour ORDER BY hour`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT nickname, score, home_runs homeRuns, distance, played_at playedAt
        FROM scores WHERE played_at >= ? AND played_at < ? ORDER BY played_at DESC LIMIT 8`).bind(
        from,
        to,
      ),
    ]);
    const first = (index: number) => results[index].results?.[0] ?? {};
    return Response.json(
      {
        period,
        summary: first(0),
        players: first(1),
        daily: results[2].results ?? [],
        hourly: results[3].results ?? [],
        recent: results[4].results ?? [],
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'admin dashboard failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json(
      { error: '운영 현황을 불러오지 못했어.' },
      { status: 503 },
    );
  }
}
