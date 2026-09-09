import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const resetRoute = await readFile(
  new URL('../app/api/admin/reset/route.ts', import.meta.url),
  'utf8',
);
const publicRankings = await readFile(
  new URL('../app/api/scores/route.ts', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../migrations/0007_admin_hotfix.sql', import.meta.url),
  'utf8',
);
const missRepairMigration = await readFile(
  new URL('../migrations/0009_repair_miss_totals.sql', import.meta.url),
  'utf8',
);
const gameRoute = await readFile(
  new URL('../app/api/game/route.ts', import.meta.url),
  'utf8',
);

test('bulk ranking clear preserves gameplay and analytics records', () => {
  assert.match(resetRoute, /ranking_cleared_at/);
  assert.match(resetRoute, /CLEAR_RANKINGS/);
  assert.doesNotMatch(resetRoute, /DELETE FROM scores/);
  assert.doesNotMatch(resetRoute, /DELETE FROM game_sessions/);
  assert.doesNotMatch(resetRoute, /DELETE FROM daily_stats/);
  assert.match(publicRankings, /ranking_cleared_at/);
});

test('historical distance is repaired from the best retained distance', () => {
  assert.match(migration, /SET total_distance = distance/);
  assert.match(migration, /UPDATE daily_stats/);
  assert.match(migration, /SUM\(s\.total_distance\)/);
});

test('completed games derive whiffs from all ten canonical outcomes', () => {
  assert.match(
    gameRoute,
    /MAX\(0, 10 - \(fouls \+ infield_hits \+ singles \+ doubles \+ triples \+ home_runs\)\)/,
  );
  assert.match(missRepairMigration, /0006_admin_operations\.sql/);
  assert.match(missRepairMigration, /AND score = 0/);
  assert.match(missRepairMigration, /UPDATE daily_stats/);
  assert.doesNotMatch(missRepairMigration, /WHERE score > 0[\s\S]*SET misses/);
});
