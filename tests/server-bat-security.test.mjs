import assert from 'node:assert/strict';
import test from 'node:test';
import { batProgress, playerIdentity } from '../lib/player-session.ts';

test('anonymous player identity uses a secure server-only cookie and reuses valid ids', () => {
  const first = playerIdentity(new Request('https://utangbaseball.cloud/api/game'));
  assert.match(first.playerId, /^[0-9a-f-]{36}$/i);
  assert.match(first.setCookie, /HttpOnly; Secure; SameSite=Lax/);

  const repeat = playerIdentity(new Request('https://utangbaseball.cloud/api/game', { headers: { cookie: `other=x; utang_player=${first.playerId}` } }));
  assert.equal(repeat.playerId, first.playerId);
  assert.equal(repeat.setCookie, null);
});

test('invalid client cookie cannot select or advance an equipped bat', () => {
  const invalid = playerIdentity(new Request('https://utangbaseball.cloud/api/game', { headers: { cookie: 'utang_player=diamond' } }));
  assert.notEqual(invalid.playerId, 'diamond');
  assert.equal(batProgress(0).equippedBat, 'basic');
  assert.deepEqual(
    [batProgress(1).equippedBat, batProgress(2).equippedBat, batProgress(7).equippedBat],
    ['gold', 'diamond', 'diamond'],
  );
});

test('server reward progress exposes no score multiplier', () => {
  const progress = batProgress(2);
  assert.equal(progress.reward, 'diamond');
  assert.equal('multiplier' in progress, false);
  assert.equal('scoreBonus' in progress, false);
});
