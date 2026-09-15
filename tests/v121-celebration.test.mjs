import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../app/v121.css', import.meta.url), 'utf8');

test('contact feedback uses a baseball burst instead of comic sound-effect text', () => {
  assert.match(page, /className="impact-ball"[\s\S]*?baseball-official-cutout\.png/);
  assert.doesNotMatch(page, /\? '쾅!'|\? '탁!'|: '딱!'/);
  assert.match(styles, /\.comic-contact-effect > i/);
  assert.match(styles, /@keyframes impact-ring-v121/);
});

test('home runs add three fireworks and a thirty-piece confetti layer over the stands', () => {
  assert.match(page, /\['left', 'center', 'right'\]\.map/);
  assert.match(page, /length: 30/);
  assert.match(styles, /\.stadium-celebration/);
  assert.match(styles, /@keyframes firework-ray-v121/);
  assert.match(styles, /@keyframes confetti-fall-v121/);
});

test('home-run emphasis replaces the old exclamation speech bubble with an energy crest', () => {
  assert.match(page, /className="batter-impact-bubble"[\s\S]*?<b \/>/);
  assert.doesNotMatch(page, /className="batter-impact-bubble"[^>]*>\s*!!/);
  assert.match(styles, /graphic energy crest replaces the old !! speech bubble/);
});

test('celebration effects respect reduced-motion preferences', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.stadium-confetti \{ display: none; \}/);
});
