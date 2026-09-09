import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { adminPeriod } from '@/lib/admin-period';
import { koreanDayStart } from '@/lib/daily-bat';
import { pickUtangNickname } from '@/lib/nickname-alias';
import { BodyTooLargeError, readLimitedJson } from '@/lib/request-body';

const SORTS = {
  score: 's.score DESC, s.played_at ASC',
  newest: 's.played_at DESC',
  distance: 's.distance DESC, s.score DESC',
} as const;

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const { from, to } = adminPeriod(url);
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, 20);
  const page = Math.max(
    1,
    Math.floor(Number(url.searchParams.get('page')) || 1),
  );
  const sortKey = url.searchParams.get('sort') as keyof typeof SORTS;
  const order = SORTS[sortKey] ?? SORTS.score;
  const where = search
    ? `s.played_at >= ? AND s.played_at < ?
       AND s.played_at > COALESCE((SELECT state_value FROM admin_state WHERE state_key = 'ranking_cleared_at'), 0)
       AND (s.nickname LIKE ? ESCAPE '\\'
         OR (a.enabled = 1 AND a.replacement_nickname LIKE ? ESCAPE '\\'))`
    : `s.played_at >= ? AND s.played_at < ?
       AND s.played_at > COALESCE((SELECT state_value FROM admin_state WHERE state_key = 'ranking_cleared_at'), 0)`;
  const bindings: Array<string | number> = [from, to];
  if (search) {
    const escaped = `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    bindings.push(escaped, escaped);
  }
  try {
    const list = env.DB.prepare(`SELECT s.id, s.nickname originalNickname,
      CASE WHEN a.enabled = 1 THEN a.replacement_nickname ELSE s.nickname END nickname,
      a.replacement_nickname replacementNickname, COALESCE(a.enabled, 0) nicknameMasked,
      s.score, s.home_runs homeRuns,
      s.distance, s.max_combo maxCombo, s.played_at playedAt,
      COALESCE((SELECT COUNT(*) FROM nickname_reports r WHERE r.nickname = s.nickname), 0) reportCount
      FROM scores s LEFT JOIN nickname_aliases a ON a.original_nickname = s.nickname
      WHERE ${where} ORDER BY ${order} LIMIT 30 OFFSET ?`).bind(
        ...bindings,
        (page - 1) * 30,
      );
    const count = env.DB.prepare(
      `SELECT COUNT(*) total FROM scores s
       LEFT JOIN nickname_aliases a ON a.original_nickname = s.nickname
       WHERE ${where}`,
    ).bind(...bindings);
    const [rows, total] = await env.DB.batch<Record<string, number | string>>([
      list,
      count,
    ]);
    return Response.json({
      records: rows.results ?? [],
      total: Number(total.results?.[0]?.total ?? 0),
      page,
    });
  } catch {
    return Response.json({ error: '랭킹을 불러오지 못했어.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readLimitedJson(request);
    const nickname =
      typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 10) : '';
    const enabled = body.enabled === true;
    if (!nickname || typeof body.enabled !== 'boolean')
      return Response.json({ error: '닉네임 설정값을 확인해줘.' }, { status: 400 });

    const [score, existing, usedAliases] = await env.DB.batch<
      Record<string, string | number>
    >([
      env.DB.prepare('SELECT 1 found FROM scores WHERE nickname = ? LIMIT 1').bind(nickname),
      env.DB.prepare(
        'SELECT replacement_nickname replacementNickname FROM nickname_aliases WHERE original_nickname = ?',
      ).bind(nickname),
      env.DB.prepare(
        'SELECT replacement_nickname replacementNickname FROM nickname_aliases WHERE original_nickname <> ?',
      ).bind(nickname),
    ]);
    if (!score.results?.length)
      return Response.json({ error: '이미 사라진 닉네임이야.' }, { status: 404 });

    const replacementNickname =
      String(existing.results?.[0]?.replacementNickname ?? '') ||
      pickUtangNickname(
        (usedAliases.results ?? []).map((row) => String(row.replacementNickname)),
      );
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO nickname_aliases(
        original_nickname, replacement_nickname, enabled, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(original_nickname) DO UPDATE SET
        enabled = excluded.enabled,
        updated_at = excluded.updated_at`).bind(
        nickname,
        replacementNickname,
        enabled ? 1 : 0,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(
        enabled ? 'MASK_NICKNAME' : 'RESTORE_NICKNAME',
        'nickname',
        nickname,
        enabled ? `표시 이름: ${replacementNickname}` : '원래 닉네임으로 복원',
        now,
      ),
    ]);
    return Response.json({
      ok: true,
      originalNickname: nickname,
      nickname: enabled ? replacementNickname : nickname,
      replacementNickname,
      nicknameMasked: enabled,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    return Response.json({ error: '표시 닉네임을 바꾸지 못했어.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readLimitedJson(request);
    const id = Number(body.id);
    if (!Number.isInteger(id) || body.confirm !== '기록 삭제')
      return Response.json(
        { error: '삭제 확인 문구가 맞지 않아.' },
        { status: 400 },
      );
    const row = await env.DB.prepare(
      'SELECT id, nickname, player_id, played_at FROM scores WHERE id = ?',
    )
      .bind(id)
      .first<{
        id: number;
        nickname: string;
        player_id: string | null;
        played_at: number;
      }>();
    if (!row)
      return Response.json({ error: '이미 없는 기록이야.' }, { status: 404 });
    const deleted = await env.DB.prepare('DELETE FROM scores WHERE id = ?')
      .bind(id)
      .run();
    if (!deleted.meta.changes)
      return Response.json({ error: '기록을 지우지 못했어.' }, { status: 409 });
    const dayStart = koreanDayStart(row.played_at);
    const dayEnd = dayStart + 86_400_000;
    await env.DB.batch([
      env.DB.prepare(`UPDATE daily_stats SET
        completed_games = (SELECT COUNT(*) FROM scores WHERE played_at >= ? AND played_at < ?),
        total_score = COALESCE((SELECT SUM(score) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        max_score = COALESCE((SELECT MAX(score) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        home_runs = COALESCE((SELECT SUM(home_runs) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        misses = COALESCE((SELECT SUM(misses) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        fouls = COALESCE((SELECT SUM(fouls) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        infield_hits = COALESCE((SELECT SUM(infield_hits) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        singles = COALESCE((SELECT SUM(singles) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        doubles = COALESCE((SELECT SUM(doubles) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        triples = COALESCE((SELECT SUM(triples) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        total_distance = COALESCE((SELECT SUM(total_distance) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        max_distance = COALESCE((SELECT MAX(distance) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        sum_max_combo = COALESCE((SELECT SUM(max_combo) FROM scores WHERE played_at >= ? AND played_at < ?), 0),
        max_combo = COALESCE((SELECT MAX(max_combo) FROM scores WHERE played_at >= ? AND played_at < ?), 0)
        WHERE day_start = ?`).bind(
        ...Array.from({ length: 14 }, () => [dayStart, dayEnd]).flat(),
        dayStart,
      ),
      env.DB.prepare(
        'DELETE FROM daily_players WHERE day_start = ? AND player_id = ?',
      ).bind(dayStart, row.player_id ?? 'anonymous'),
      env.DB.prepare(`INSERT INTO daily_players(day_start, player_id, completed_games, last_played_at)
        SELECT ?, COALESCE(player_id, 'anonymous'), COUNT(*), MAX(played_at) FROM scores
        WHERE played_at >= ? AND played_at < ? AND COALESCE(player_id, 'anonymous') = ? HAVING COUNT(*) > 0`).bind(
        dayStart,
        dayStart,
        dayEnd,
        row.player_id ?? 'anonymous',
      ),
      env.DB.prepare(
        'INSERT INTO admin_audit_logs(action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(
        'DELETE_SCORE',
        'score',
        String(id),
        `닉네임: ${row.nickname}`,
        Date.now(),
      ),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: '요청이 너무 커.' }, { status: 413 });
    return Response.json({ error: '기록을 지우지 못했어.' }, { status: 503 });
  }
}
