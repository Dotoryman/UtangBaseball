import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateEarnedScore, completeDailyGame, createDailyBatState, normalizeDailyBatState } from '../lib/daily-bat.ts';

const firstDay = Date.UTC(2026, 8, 8, 3);
const nextDay = Date.UTC(2026, 8, 9, 3);
const batMigration = await readFile(
  new URL('../migrations/0013_expand_bat_types.sql', import.meta.url),
  'utf8',
);

test('daily completion rewards all five bats exactly once', () => {
  const initial = createDailyBatState(firstDay);
  assert.equal(initial.equippedBat, 'basic');
  const first = completeDailyGame(initial, firstDay);
  assert.deepEqual({ bat: first.state.equippedBat, reward: first.reward, count: first.state.completedGames }, { bat: 'aluminum', reward: 'aluminum', count: 1 });
  const second = completeDailyGame(first.state, firstDay);
  assert.deepEqual({ bat: second.state.equippedBat, reward: second.reward, count: second.state.completedGames }, { bat: 'gold', reward: 'gold', count: 2 });
  const third = completeDailyGame(second.state, firstDay);
  assert.deepEqual({ bat: third.state.equippedBat, reward: third.reward, count: third.state.completedGames }, { bat: 'ruby', reward: 'ruby', count: 3 });
  const fourth = completeDailyGame(third.state, firstDay);
  assert.deepEqual({ bat: fourth.state.equippedBat, reward: fourth.reward, count: fourth.state.completedGames }, { bat: 'diamond', reward: 'diamond', count: 4 });
  const fifth = completeDailyGame(fourth.state, firstDay);
  assert.deepEqual({ bat: fifth.state.equippedBat, reward: fifth.reward, count: fifth.state.completedGames }, { bat: 'diamond', reward: null, count: 5 });
});

test('a new Korean calendar day resets daily bat progress', () => {
  let earned = createDailyBatState(firstDay);
  for (let game = 0; game < 4; game += 1) earned = completeDailyGame(earned, firstDay).state;
  assert.equal(earned.equippedBat, 'diamond');
  assert.deepEqual(normalizeDailyBatState(earned, nextDay), createDailyBatState(nextDay));
});

test('bat score is rounded once after combo and active bat are applied', () => {
  assert.equal(calculateEarnedScore(1000, 0, 'basic'), 1000);
  assert.equal(calculateEarnedScore(1000, 0, 'aluminum'), 1050);
  assert.equal(calculateEarnedScore(1000, 0, 'gold'), 1100);
  assert.equal(calculateEarnedScore(1000, 0, 'ruby'), 1150);
  assert.equal(calculateEarnedScore(1000, 0, 'diamond'), 1200);
  assert.equal(calculateEarnedScore(1000, 3, 'gold'), 1430);
});

test('D1 sessions accept all five server-selected bats', () => {
  assert.match(batMigration, /'basic', 'aluminum', 'gold', 'ruby', 'diamond'/);
  assert.match(batMigration, /bat_type = 'aluminum'/);
});
