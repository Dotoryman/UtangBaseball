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
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - kstOffset;
  }
  if (period === 'weekly') {
    const day = (now.getUTCDay() + 6) % 7;
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day) - kstOffset;
  }
  return 0;
}

async function leaderboard(period = 'all') {
  const since = sinceFor(period);
  const result = await env.DB.prepare(
    `SELECT nickname, score, home_runs, distance, played_at
     FROM scores
     WHERE played_at >= ?
     ORDER BY score DESC, played_at ASC
     LIMIT 10`,
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
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const nickname =
      (typeof body.nickname === 'string' ? body.nickname.trim() : '') ||
      '우땅이';
    const score = Number(body.score);
    const homeRuns = Number(body.homeRuns);
    const distance = Number(body.distance);

    if (
      nickname.length > 10 ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 200_000 ||
      !Number.isInteger(homeRuns) ||
      homeRuns < 0 ||
      homeRuns > 10 ||
      !Number.isInteger(distance) ||
      distance < 0 ||
      distance > 200
    ) {
      return Response.json(
        { error: '잘못된 경기 기록입니다.' },
        { status: 400 },
      );
    }

    await env.DB.prepare(
      `INSERT INTO scores (nickname, score, home_runs, distance, played_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(nickname, score, homeRuns, distance, Date.now())
      .run();

    return Response.json(
      { records: await leaderboard('daily') },
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: '기록을 저장하지 못했습니다.' },
      { status: 503 },
    );
  }
}
