import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../app/v121.css', import.meta.url), 'utf8');

test('contact feedback surrounds the batter with fireworks and has no circular impact badge', () => {
  assert.match(page, /className={`batter-outcome-effect effect-/);
  assert.match(page, /className={`batter-firework burst-/);
  assert.doesNotMatch(page, /className="impact-ball"/);
  assert.doesNotMatch(page, /impact-firework-core|impact-ring|batter-impact-bubble/);
  assert.doesNotMatch(page, /\? '쾅!'|\? '탁!'|: '딱!'/);
  assert.match(styles, /\.batter-outcome-effect/);
  assert.match(styles, /@keyframes batter-firework-ray/);
});

test('hit tiers progressively add fireworks while foul and miss use a dark effect', () => {
  for (const [outcome, tier] of [
    ['INFIELD_HIT', 'infield'], ['SINGLE', 'single'], ['DOUBLE', 'double'],
    ['TRIPLE', 'triple'], ['HOME_RUN', 'homer'],
  ]) {
    assert.match(page, new RegExp(`${outcome}: '${tier}'`));
  }
  assert.match(styles, /\.effect-infield \.burst-1/);
  assert.match(styles, /\.effect-single \.burst-1, \.effect-single \.burst-2/);
  assert.match(styles, /\.effect-double[^{]+\.burst-3/);
  assert.match(styles, /\.effect-triple[^{]+\.burst-4/);
  assert.match(styles, /\.effect-homer \.batter-firework \{ display: block; \}/);
  assert.match(styles, /\.effect-foul \.outcome-gloom, \.effect-miss \.outcome-gloom/);
  assert.match(styles, /\.outcome-gloom::before/);
});

test('home runs add three fireworks and a thirty-piece confetti layer over the stands', () => {
  assert.match(page, /\['left', 'center', 'right'\]\.map/);
  assert.match(page, /length: 30/);
  assert.match(styles, /\.stadium-celebration/);
  assert.match(styles, /@keyframes firework-ray-v121/);
  assert.match(styles, /@keyframes confetti-fall-v121/);
});

test('celebration effects respect reduced-motion preferences', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.stadium-confetti \{ display: none; \}/);
});
