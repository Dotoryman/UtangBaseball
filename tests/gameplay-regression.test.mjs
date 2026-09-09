import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const server = await readFile(new URL('../app/api/game/route.ts', import.meta.url), 'utf8');

test('v1.0 keeps the approved pitch and contact timing constants unchanged', () => {
  for (const source of [client, server]) {
    assert.match(source, /WINDUP_MS = 760/);
    assert.match(source, /CONTACT_PROGRESS = 0\.86/);
    assert.match(source, /직구', duration: 1650/);
    assert.match(source, /커브', duration: 1900/);
    assert.match(source, /체인지업', duration: 2150/);
  }
  assert.match(client, /SWING_CONTACT_FRAME_MS = 78/);
  assert.match(client, /\[22, 48, 78, 114, 158\]/);
  assert.match(server, /SWING_INPUT_TRANSIT_MS = 60/);
});

test('successful contact removes the incoming ball before showing the batted ball', () => {
  assert.match(client, /triggerHitHaptic\(nextContact\.outcome\);\s+setPitch\(null\);\s+setBallFlying\(true\)/);
  assert.match(client, /if \(!isWhiff\)\s+setPitch\(null\)/);
});

test('hit vibration is attached to the existing 78ms contact frame', () => {
  assert.match(client, /previewHaptic = true;\s+triggerHitHaptic\(nextContact\.outcome\);\s+setPitch\(null\);\s+setBallFlying\(true\)/);
  assert.match(client, /if \(!previewHaptic\)\s+triggerHitHaptic\(nextContact\.outcome\)/);
});

test('server chooses the bat from completed scores and ignores a client bat field', () => {
  assert.match(server, /COUNT\(\*\) AS count FROM scores WHERE player_id = \? AND played_at >= \?/);
  assert.match(server, /progress\.equippedBat, identity\.playerId/);
  assert.doesNotMatch(server, /body\.batType/);
});
