import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEarnedScore, completeDailyGame, createDailyBatState, normalizeDailyBatState } from '../lib/daily-bat.ts';

const firstDay = Date.UTC(2026, 8, 8, 3);
const nextDay = Date.UTC(2026, 8, 9, 3);

test('daily completion rewards progress from basic to gold to diamond exactly once', () => {
  const initial = createDailyBatState(firstDay);
  assert.equal(initial.equippedBat, 'basic');
  const first = completeDailyGame(initial, firstDay);
  assert.deepEqual({ bat: first.state.equippedBat, reward: first.reward, count: first.state.completedGames }, { bat: 'gold', reward: 'gold', count: 1 });
  const second = completeDailyGame(first.state, firstDay);
  assert.deepEqual({ bat: second.state.equippedBat, reward: second.reward, count: second.state.completedGames }, { bat: 'diamond', reward: 'diamond', count: 2 });
  const third = completeDailyGame(second.state, firstDay);
  assert.deepEqual({ bat: third.state.equippedBat, reward: third.reward, count: third.state.completedGames }, { bat: 'diamond', reward: null, count: 3 });
});

test('a new Korean calendar day resets daily bat progress', () => {
  const earned = completeDailyGame(completeDailyGame(createDailyBatState(firstDay), firstDay).state, firstDay).state;
  assert.equal(earned.equippedBat, 'diamond');
  assert.deepEqual(normalizeDailyBatState(earned, nextDay), createDailyBatState(nextDay));
});

test('bat score is rounded once after combo and active bat are applied', () => {
  assert.equal(calculateEarnedScore(1000, 0, 'basic'), 1000);
  assert.equal(calculateEarnedScore(1000, 0, 'gold'), 1100);
  assert.equal(calculateEarnedScore(1000, 0, 'diamond'), 1200);
  assert.equal(calculateEarnedScore(1000, 3, 'gold'), 1430);
});
