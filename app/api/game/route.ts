import { env } from 'cloudflare:workers';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';
import {
  calculateEarnedScore,
  koreanDayStart,
  type BatType,
} from '@/lib/daily-bat';
import { batProgress, playerIdentity } from '@/lib/player-session';
import { funnelStatement } from '@/lib/analytics';
import { validateNickname } from '@/lib/nickname-filter';

type PitchType = '직구' | '커브' | '체인지업';
type Outcome =
  | 'WHIFF'
  | 'FOUL'
  | 'INFIELD_HIT'
  | 'SINGLE'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'HOME_RUN';
type SessionRow = {
  id: string;
  nickname: string;
  pitch_number: number;
  pitch_type: PitchType | null;
  pitch_duration: number | null;
  contact_at: number | null;
  score: number;
  combo: number;
  max_combo: number;
  home_runs: number;
  max_distance: number;
  completed_at: number | null;
  bat_type: BatType;
  player_id: string | null;
  misses: number;
  fouls: number;
  infield_hits: number;
  singles: number;
  doubles: number;
  triples: number;
  total_distance: number;
};

const SESSION_ID = /^[0-9a-f-]{36}$/i;
const TOTAL_PITCHES = 10;
const WINDUP_MS = 760;
const CONTACT_PROGRESS = 0.86;
const SWING_INPUT_TRANSIT_MS = 60;
const MAX_REPORTED_SWING_DRIFT_MS = 250;
const PITCHES: Array<{ type: PitchType; duration: number }> = [
  { type: '직구', duration: 1650 },
  { type: '커브', duration: 1900 },
  { type: '체인지업', duration: 2150 },
];

function secureRandom() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function calculateContact(error: number) {
  if (error > 0.34)
    return {
      outcome: 'WHIFF' as Outcome,
      distance: 0,
      exitVelocity: 0,
      launchAngle: 0,
      points: 0,
    };
  if (error > 0.24)
    return {
      outcome: 'FOUL' as Outcome,
      distance: 0,
      exitVelocity: 78,
      launchAngle: 48,
      points: 180,
    };
  const quality = clamp(1 - error / 0.24, 0, 1);
  const exitVelocity = Math.round(
    clamp(76 + quality * 87 + (secureRandom() - 0.5) * 8, 72, 166),
  );
  const launchAngle = Math.round(
    clamp(-7 + quality * 37 + (secureRandom() - 0.5) * 10, -10, 38),
  );
  const angleEfficiency = clamp(1 - Math.abs(launchAngle - 27) / 42, 0.2, 1);
  const distance = Math.round(
    clamp(
      (exitVelocity - 68) * 1.42 * angleEfficiency + secureRandom() * 7,
      8,
      150,
    ),
  );
  let outcome: Outcome = 'INFIELD_HIT';
  if (distance >= 115) outcome = 'HOME_RUN';
  else if (distance >= 96) outcome = 'TRIPLE';
  else if (distance >= 73) outcome = 'DOUBLE';
  else if (distance >= 30) outcome = 'SINGLE';
  const base = {
    INFIELD_HIT: 800,
    SINGLE: 1200,
    DOUBLE: 2100,
    TRIPLE: 3000,
    HOME_RUN: 4500,
  }[outcome];
  return {
    outcome,
    distance,
    exitVelocity,
    launchAngle,
    points: base + distance * 10,
  };
}
function sessionId(body: Record<string, unknown>) {
  return typeof body.sessionId === 'string' && SESSION_ID.test(body.sessionId)
    ? body.sessionId
    : null;
}

export async function POST(request: Request) {
  try {
    const body = await readLimitedJson(request);
    const action = body.action;
    if (action === 'start') {
      const checked = await validateNickname(
        env.DB,
        typeof body.nickname === 'string' ? body.nickname : '',
      );
      if (!checked.ok)
        return Response.json({ error: checked.error }, { status: 400 });
      const nickname = checked.nickname;
      const identity = playerIdentity(request);
      const id = crypto.randomUUID();
      const now = Date.now();
      const dayStart = koreanDayStart(now);
      const completed = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM scores WHERE player_id = ? AND played_at >= ?',
      )
        .bind(identity.playerId, dayStart)
        .first<{ count: number }>();
      const progress = batProgress(completed?.count ?? 0, now);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM game_sessions WHERE created_at < ?').bind(
          now - 2 * 60 * 60 * 1000,
        ),
        env.DB.prepare(
          'INSERT INTO game_sessions (id, nickname, created_at, bat_type, player_id) VALUES (?, ?, ?, ?, ?)',
        ).bind(id, nickname, now, progress.equippedBat, identity.playerId),
        funnelStatement(env.DB, identity.playerId, 'game_start', now),
      ]);
      const headers = identity.setCookie
        ? { 'Set-Cookie': identity.setCookie }
        : undefined;
      return Response.json(
        {
          sessionId: id,
          batType: progress.equippedBat,
          completedGames: progress.completedGames,
          dayStart: progress.dayStart,
        },
        { status: 201, headers },
      );
    }

    const id = sessionId(body);
    const pitchNumber = Number(body.pitchNumber);
    if (
      !id ||
      !Number.isInteger(pitchNumber) ||
      pitchNumber < 1 ||
      pitchNumber > TOTAL_PITCHES
    ) {
      return Response.json(
        { error: '잘못된 경기 요청입니다.' },
        { status: 400 },
      );
    }
    const row = await env.DB.prepare('SELECT * FROM game_sessions WHERE id = ?')
      .bind(id)
      .first<SessionRow>();
    if (!row || row.completed_at)
      return Response.json({ error: '종료된 경기입니다.' }, { status: 409 });

    if (action === 'pitch') {
      if (row.pitch_number !== pitchNumber - 1 || row.contact_at !== null)
        return Response.json(
          { error: '공 순서가 맞지 않습니다.' },
          { status: 409 },
        );
      const config = PITCHES[Math.floor(secureRandom() * PITCHES.length)];
      // A negative value is the legacy-client fallback. Current clients replace
      // it with a synchronized target when the ball is actually painted.
      const contactAt = -(
        Date.now() +
        WINDUP_MS +
        config.duration * CONTACT_PROGRESS
      );
      const update = await env.DB.prepare(
        'UPDATE game_sessions SET pitch_number = ?, pitch_type = ?, pitch_duration = ?, contact_at = ? WHERE id = ? AND pitch_number = ? AND contact_at IS NULL AND completed_at IS NULL',
      )
        .bind(
          pitchNumber,
          config.type,
          config.duration,
          Math.round(contactAt),
          id,
          pitchNumber - 1,
        )
        .run();
      if (!update.meta.changes)
        return Response.json(
          { error: '이미 시작한 공입니다.' },
          { status: 409 },
        );
      return Response.json({ pitch: config, windupMs: WINDUP_MS });
    }

    if (action === 'release') {
      if (
        row.pitch_number !== pitchNumber ||
        row.contact_at === null ||
        !row.pitch_duration
      )
        return Response.json(
          { error: '진행 중인 공이 없습니다.' },
          { status: 409 },
        );
      if (row.contact_at > 0) return Response.json({ released: true });
      const contactAt = Math.round(
        Date.now() + row.pitch_duration * CONTACT_PROGRESS,
      );
      const update = await env.DB.prepare(
        'UPDATE game_sessions SET contact_at = ? WHERE id = ? AND pitch_number = ? AND contact_at = ? AND completed_at IS NULL',
      )
        .bind(contactAt, id, pitchNumber, row.contact_at)
        .run();
      if (!update.meta.changes)
        return Response.json(
          { error: '공 출발을 맞추지 못했습니다.' },
          { status: 409 },
        );
      return Response.json({ released: true });
    }

    if (action !== 'swing' && action !== 'miss')
      return Response.json(
        { error: '지원하지 않는 요청입니다.' },
        { status: 400 },
      );
    if (
      row.pitch_number !== pitchNumber ||
      row.contact_at === null ||
      !row.pitch_duration
    )
      return Response.json(
        { error: '진행 중인 공이 없습니다.' },
        { status: 409 },
      );
    const now = Date.now();
    const contactAt = Math.abs(row.contact_at);
    if (
      action === 'miss' &&
      now < contactAt + row.pitch_duration * (1 - CONTACT_PROGRESS) - 50
    ) {
      return Response.json(
        { error: '아직 공이 도착하지 않았습니다.' },
        { status: 409 },
      );
    }
    let swingError =
      Math.abs(now - SWING_INPUT_TRANSIT_MS - contactAt) / row.pitch_duration;
    const reportedElapsed = body.swingElapsedMs;
    if (
      action === 'swing' &&
      row.contact_at > 0 &&
      typeof reportedElapsed === 'number' &&
      Number.isFinite(reportedElapsed)
    ) {
      const releaseAt = contactAt - row.pitch_duration * CONTACT_PROGRESS;
      const serverElapsed = now - releaseAt;
      const validElapsed =
        reportedElapsed >= 0 && reportedElapsed <= row.pitch_duration * 1.25;
      const plausibleTransit =
        Math.abs(serverElapsed - reportedElapsed) <=
        MAX_REPORTED_SWING_DRIFT_MS;
      if (validElapsed && plausibleTransit)
        swingError =
          Math.abs(reportedElapsed - row.pitch_duration * CONTACT_PROGRESS) /
          row.pitch_duration;
    }
    const contact =
      action === 'miss' ? calculateContact(1) : calculateContact(swingError);
    const keepsCombo = !['WHIFF', 'FOUL'].includes(contact.outcome);
    const combo = keepsCombo ? row.combo + 1 : 0;
    const maxCombo = Math.max(row.max_combo, combo);
    const earned = calculateEarnedScore(contact.points, combo, row.bat_type);
    const score = row.score + earned;
    const homeRuns = row.home_runs + (contact.outcome === 'HOME_RUN' ? 1 : 0);
    const maxDistance = Math.max(row.max_distance, contact.distance);
    const misses = row.misses + (contact.outcome === 'WHIFF' ? 1 : 0);
    const fouls = row.fouls + (contact.outcome === 'FOUL' ? 1 : 0);
    const infieldHits =
      row.infield_hits + (contact.outcome === 'INFIELD_HIT' ? 1 : 0);
    const singles = row.singles + (contact.outcome === 'SINGLE' ? 1 : 0);
    const doubles = row.doubles + (contact.outcome === 'DOUBLE' ? 1 : 0);
    const triples = row.triples + (contact.outcome === 'TRIPLE' ? 1 : 0);
    const totalDistance = row.total_distance + contact.distance;
    const completedAt = pitchNumber === TOTAL_PITCHES ? now : null;
    const updateStatement = env.DB.prepare(
      `UPDATE game_sessions SET contact_at = NULL, score = ?, combo = ?, max_combo = ?,
       home_runs = ?, max_distance = ?, misses = ?, fouls = ?, infield_hits = ?,
       singles = ?, doubles = ?, triples = ?, total_distance = ?, completed_at = ?
       WHERE id = ? AND contact_at = ? AND completed_at IS NULL`,
    ).bind(
      score,
      combo,
      maxCombo,
      homeRuns,
      maxDistance,
      misses,
      fouls,
      infieldHits,
      singles,
      doubles,
      triples,
      totalDistance,
      completedAt,
      id,
      row.contact_at,
    );
    const update = completedAt
      ? (
          await env.DB.batch([
            updateStatement,
            env.DB.prepare(`INSERT OR IGNORE INTO scores (
            nickname, score, home_runs, distance, played_at, session_id, player_id,
            misses, fouls, infield_hits, singles, doubles, triples, total_distance, max_combo
          ) SELECT nickname, score, home_runs, max_distance, completed_at, id, player_id,
            misses, fouls, infield_hits, singles, doubles, triples, total_distance, max_combo
            FROM game_sessions WHERE id = ? AND completed_at = ?`).bind(
              id,
              completedAt,
            ),
          ])
        )[0]
      : await updateStatement.run();
    if (!update.meta.changes)
      return Response.json({ error: '이미 판정된 공입니다.' }, { status: 409 });
    let dailyBat = null;
    if (completedAt && row.player_id) {
      const completed = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM scores WHERE player_id = ? AND played_at >= ?',
      )
        .bind(row.player_id, koreanDayStart(completedAt))
        .first<{ count: number }>();
      dailyBat = batProgress(completed?.count ?? 0, completedAt);
    }
    return Response.json({
      contact,
      stats: { score, combo, maxCombo, homeRuns, maxDistance },
      completed: Boolean(completedAt),
      dailyBat,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    if (error instanceof SyntaxError)
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    console.error(
      JSON.stringify({
        message: 'game request failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json(
      { error: '경기를 처리하지 못했습니다.' },
      { status: 503 },
    );
  }
}
