import { env } from 'cloudflare:workers';

type ScoreRow = {
  nickname: string;
  score: number;
  home_runs: number;
  distance: number;
  played_at: number;
};

function sinceFor(period: string) {
  const kstOffset = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + kstOffset);
  if (period === 'daily') {
    return (
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      kstOffset
    );
  }
  if (period === 'weekly') {
    const day = (now.getUTCDay() + 6) % 7;
    return (
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - day,
      ) - kstOffset
    );
  }
  return 0;
}

async function leaderboard(period = 'all') {
  const since = sinceFor(period);
  const result = await env.DB.prepare(
    `SELECT CASE WHEN a.enabled = 1 THEN a.replacement_nickname ELSE s.nickname END nickname,
            s.score, s.home_runs, s.distance, s.played_at
     FROM scores s
     LEFT JOIN nickname_aliases a ON a.original_nickname = s.nickname
     WHERE s.played_at >= ?
       AND s.played_at > COALESCE((
         SELECT state_value FROM admin_state WHERE state_key = 'ranking_cleared_at'
       ), 0)
     ORDER BY s.score DESC, s.played_at ASC
     LIMIT 50`,
  )
    .bind(since)
    .all<ScoreRow>();

  return (result.results ?? []).map((row) => ({
    nickname: row.nickname,
    score: row.score,
    homeRuns: row.home_runs,
    distance: row.distance,
    playedAt: row.played_at,
  }));
}

export async function GET(request: Request) {
  try {
    const period = new URL(request.url).searchParams.get('period') ?? 'all';
    return Response.json(
      { records: await leaderboard(period) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ records: [], offline: true }, { status: 503 });
  }
}

export async function POST(request: Request) {
  void request;
  return Response.json(
    { error: '점수는 완료된 경기에서만 등록됩니다.' },
    { status: 405, headers: { Allow: 'GET' } },
  );
}
