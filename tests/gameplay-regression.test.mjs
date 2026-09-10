import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const server = await readFile(new URL('../app/api/game/route.ts', import.meta.url), 'utf8');
const config = await readFile(new URL('../lib/game-config.ts', import.meta.url), 'utf8');

test('v1.2 shares the seven-pitch faster game timing between client and server', () => {
  assert.match(config, /TOTAL_PITCHES = 7/);
  assert.match(config, /WINDUP_MS = 760/);
  assert.match(config, /CONTACT_PROGRESS = 0\.86/);
  assert.match(config, /직구', duration: 1500/);
  assert.match(config, /커브', duration: 1725/);
  assert.match(config, /체인지업', duration: 1950/);
  for (const source of [client, server])
    assert.match(source, /CONTACT_PROGRESS,\s+PITCHES,\s+TOTAL_PITCHES,\s+WINDUP_MS/);
  assert.match(client, /SWING_CONTACT_FRAME_MS = 78/);
  assert.match(client, /\[22, 48, 78, 114, 158\]/);
  assert.match(server, /SWING_INPUT_TRANSIT_MS = 60/);
});

test('successful contact removes the incoming ball before showing the batted ball', () => {
  assert.match(client, /triggerHitHaptic\(nextContact\.outcome\);\s+setPitch\(null\);\s+setBallFlying\(true\)/);
  assert.match(client, /if \(!isWhiff\)\s+setPitch\(null\)/);
});

test('intro and result characters use the currently earned bat', () => {
  assert.match(client, /backgroundImage: `url\(\$\{BAT_SPRITES\[dailyBatState\.equippedBat\]\}\)`/);
  assert.match(client, /const resultBat = dailyBatState\.equippedBat/);
  assert.match(client, /followPoseForBat\(resultBat\)/);
  assert.match(client, /missPoseForBat\(resultBat\)/);
});

test('the seven-pitch counter does not add a leading zero', () => {
  assert.doesNotMatch(client, /String\(pitchNumber\)\.padStart/);
  assert.match(client, /\{pitchNumber\}[\s\S]*?\/ \{TOTAL_PITCHES\}/);
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
