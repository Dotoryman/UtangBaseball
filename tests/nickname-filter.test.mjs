import assert from 'node:assert/strict';
import test from 'node:test';
import { containsBannedWord, normalizeNickname } from '../lib/nickname-filter.ts';

test('nickname normalization catches spacing, symbols, and repeated-character evasion', () => {
  assert.equal(normalizeNickname('  씨! 발  '), '씨발');
  assert.equal(containsBannedWord('씨---발', ['씨발']), true);
  assert.equal(containsBannedWord('씨씨씨발', ['씨발']), true);
  assert.equal(containsBannedWord('F.U.C.K', ['fuck']), true);
});

test('nickname filtering does not block ordinary Utang names', () => {
  const words = ['씨발', '병신', '개새끼', 'fuck'];
  for (const nickname of ['우땅이', '홈런왕', '도토리맨', '삼성팬', '시골우땅']) {
    assert.equal(containsBannedWord(nickname, words), false, nickname);
  }
});
