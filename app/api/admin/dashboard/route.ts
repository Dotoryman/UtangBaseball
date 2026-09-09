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
        COALESCE(SUM(total_score), 0) total_score,
        COALESCE(MAX(max_score), 0) max_score,
        COALESCE(SUM(home_runs), 0) home_runs,
        COALESCE(SUM(misses), 0) misses,
        COALESCE(SUM(fouls), 0) fouls,
        COALESCE(SUM(infield_hits), 0) infield_hits,
        COALESCE(SUM(singles), 0) singles,
        COALESCE(SUM(doubles), 0) doubles,
        COALESCE(SUM(triples), 0) triples,
        COALESCE(SUM(total_distance), 0) total_distance,
        COALESCE(MAX(max_distance), 0) max_distance,
        COALESCE(SUM(sum_max_combo), 0) sum_max_combo,
        COALESCE(MAX(max_combo), 0) max_combo,
        COALESCE(SUM(share_clicks), 0) share_clicks,
        COALESCE(SUM(referrals), 0) referrals
        FROM daily_stats WHERE day_start >= ? AND day_start < ?`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT COUNT(*) users,
        COALESCE(AVG(games), 0) avg_plays,
        COALESCE(SUM(CASE WHEN games = 1 THEN 1 ELSE 0 END), 0) one_play,
        COALESCE(SUM(CASE WHEN games >= 2 THEN 1 ELSE 0 END), 0) two_plus,
        COALESCE(SUM(CASE WHEN games >= 3 THEN 1 ELSE 0 END), 0) three_plus
        FROM (SELECT player_id, SUM(completed_games) games FROM daily_players
          WHERE day_start >= ? AND day_start < ? AND player_id != 'anonymous' GROUP BY player_id)`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT day_start day, completed_games plays, home_runs homeRuns,
        share_clicks shares, max_score topScore FROM daily_stats
        WHERE day_start >= ? AND day_start < ? ORDER BY day_start`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT CAST(strftime('%H', played_at / 1000, 'unixepoch', '+9 hours') AS INTEGER) hour,
        COUNT(*) plays FROM scores WHERE played_at >= ? AND played_at < ? GROUP BY hour ORDER BY hour`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT event, COUNT(*) users, SUM(event_count) events FROM funnel_events
        WHERE day_start >= ? AND day_start < ? GROUP BY event`).bind(from, to),
      env.DB.prepare(`SELECT
        SUM(CASE WHEN distance = 0 THEN 1 ELSE 0 END) d0,
        SUM(CASE WHEN distance BETWEEN 1 AND 29 THEN 1 ELSE 0 END) d1,
        SUM(CASE WHEN distance BETWEEN 30 AND 72 THEN 1 ELSE 0 END) d2,
        SUM(CASE WHEN distance BETWEEN 73 AND 95 THEN 1 ELSE 0 END) d3,
        SUM(CASE WHEN distance BETWEEN 96 AND 114 THEN 1 ELSE 0 END) d4,
        SUM(CASE WHEN distance >= 115 THEN 1 ELSE 0 END) d5,
        SUM(CASE WHEN max_combo = 0 THEN 1 ELSE 0 END) c0,
        SUM(CASE WHEN max_combo BETWEEN 1 AND 2 THEN 1 ELSE 0 END) c1,
        SUM(CASE WHEN max_combo BETWEEN 3 AND 5 THEN 1 ELSE 0 END) c2,
        SUM(CASE WHEN max_combo BETWEEN 6 AND 9 THEN 1 ELSE 0 END) c3,
        SUM(CASE WHEN max_combo >= 10 THEN 1 ELSE 0 END) c4
        FROM scores WHERE played_at >= ? AND played_at < ?`).bind(from, to),
      env.DB.prepare(`SELECT nickname, score, home_runs homeRuns, distance, played_at playedAt
        FROM scores WHERE played_at >= ? AND played_at < ? ORDER BY played_at DESC LIMIT 8`).bind(
        from,
        to,
      ),
      env.DB.prepare(`SELECT COUNT(DISTINCT player_id) recent_users FROM game_sessions
        WHERE created_at >= ? AND player_id IS NOT NULL`).bind(
        Date.now() - 5 * 60 * 1000,
      ),
      env.DB.prepare(`SELECT COALESCE(SUM(completed_games), 0) plays,
        COALESCE(SUM(home_runs), 0) homeRuns,
        COALESCE(SUM(infield_hits + singles + doubles + triples + home_runs), 0) hits,
        COALESCE(SUM(total_distance), 0) totalDistance,
        COALESCE(MAX(max_distance), 0) maxDistance,
        COALESCE(MAX(max_score), 0) maxScore,
        COALESCE(SUM(misses), 0) misses,
        COALESCE(SUM(share_clicks), 0) shares FROM daily_stats`),
    ]);
    const first = (index: number) => results[index].results?.[0] ?? {};
    return Response.json(
      {
        period,
        summary: first(0),
        players: first(1),
        daily: results[2].results ?? [],
        hourly: results[3].results ?? [],
        funnel: results[4].results ?? [],
        distributions: first(5),
        recent: results[6].results ?? [],
        recentUsers: Number(first(7).recent_users ?? 0),
        lifetime: first(8),
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
