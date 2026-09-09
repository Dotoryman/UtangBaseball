import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  pickUtangNickname,
  UTANG_NICKNAME_ALIASES,
} from '../lib/nickname-alias.ts';

const publicRankings = await readFile(
  new URL('../app/api/scores/route.ts', import.meta.url),
  'utf8',
);
const adminRankings = await readFile(
  new URL('../app/api/admin/rankings/route.ts', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../migrations/0008_nickname_aliases.sql', import.meta.url),
  'utf8',
);
const defaultMigration = await readFile(
  new URL('../migrations/0010_default_nickname_aliases.sql', import.meta.url),
  'utf8',
);
const gameRoute = await readFile(
  new URL('../app/api/game/route.ts', import.meta.url),
  'utf8',
);

test('replacement nicknames are friendly Utang names within the score limit', () => {
  assert.ok(UTANG_NICKNAME_ALIASES.length >= 30);
  for (const nickname of UTANG_NICKNAME_ALIASES) {
    assert.match(nickname, /우땅이$/);
    assert.ok(nickname.length <= 10, nickname);
  }
});

test('alias selection skips names already assigned to other players', () => {
  const first = UTANG_NICKNAME_ALIASES[0];
  assert.notEqual(pickUtangNickname([first], () => 0), first);
});

test('alias selection keeps producing distinct Utang names after the curated list', () => {
  const excluded = new Set(UTANG_NICKNAME_ALIASES);
  const fallback = pickUtangNickname(excluded, () => 0);
  assert.match(fallback, /^\d+번타자 우땅이$/);
  assert.ok(fallback.length <= 10);
});

test('public rankings switch display names without overwriting score nicknames', () => {
  assert.match(publicRankings, /LEFT JOIN nickname_aliases/);
  assert.match(publicRankings, /CASE WHEN a\.enabled = 1 THEN a\.replacement_nickname/);
  assert.match(adminRankings, /export async function PATCH/);
  assert.match(adminRankings, /body\.all === true/);
  assert.match(adminRankings, /MASK_ALL_NICKNAMES/);
  assert.match(adminRankings, /ON CONFLICT\(original_nickname\) DO UPDATE SET/);
  assert.doesNotMatch(adminRankings, /UPDATE scores SET nickname/);
  assert.match(migration, /original_nickname TEXT PRIMARY KEY/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS nickname_aliases_replacement_idx/);
});

test('existing and newly completed players receive aliases by default', () => {
  assert.match(defaultMigration, /ROW_NUMBER\(\) OVER/);
  assert.match(defaultMigration, /WHEN 40 THEN '끝까지뛴 우땅이'/);
  assert.match(defaultMigration, /ELSE printf\('%d번타자 우땅이'/);
  assert.match(gameRoute, /ensureNicknameAlias\(env\.DB, row\.nickname\)/);
});
