import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(
  new URL('../app/admin/page.tsx', import.meta.url),
  'utf8',
);
const route = await readFile(
  new URL('../app/api/admin/dashboard/route.ts', import.meta.url),
  'utf8',
);

test('admin play statistics focus on hourly activity and exact play counts', () => {
  assert.match(page, /시간대별 플레이/);
  assert.match(page, /사용자별 완료 판수/);
  assert.match(page, /\['5판 이상', players\.five_plus\]/);
  assert.match(route, /games = 2/);
  assert.match(route, /games = 3/);
  assert.match(route, /games = 4/);
  assert.match(route, /games >= 5/);
});

test('unused outcome, distance, combo and funnel panels are not queried or rendered', () => {
  for (const label of [
    '타격 결과',
    '비거리 분포',
    '최고 콤보 분포',
    '플레이 흐름',
  ])
    assert.doesNotMatch(page, new RegExp(label));
  assert.doesNotMatch(route, /FROM funnel_events/);
  assert.doesNotMatch(route, /SUM\(CASE WHEN distance/);
  assert.doesNotMatch(route, /SUM\(CASE WHEN max_combo/);
});
