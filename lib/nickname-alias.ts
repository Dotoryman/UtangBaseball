export const UTANG_NICKNAME_ALIASES = [
  '귀여운 우땅이',
  '용감한 우땅이',
  '씩씩한 우땅이',
  '신나는 우땅이',
  '졸린 우땅이',
  '배고픈 우땅이',
  '날쌘 우땅이',
  '엉뚱한 우땅이',
  '수줍은 우땅이',
  '당당한 우땅이',
  '야무진 우땅이',
  '행복한 우땅이',
  '행운의 우땅이',
  '홈런왕 우땅이',
  '안타왕 우땅이',
  '타격왕 우땅이',
  '도루왕 우땅이',
  '장타왕 우땅이',
  '역전왕 우땅이',
  '야구왕 우땅이',
  '번트왕 우땅이',
  '강속구 우땅이',
  '끝내기 우땅이',
  '만루포 우땅이',
  '직구왕 우땅이',
  '변화구 우땅이',
  '야구천재 우땅이',
  '타격천재 우땅이',
  '헛스윙 우땅이',
  '불방망이 우땅이',
] as const;

export function pickUtangNickname(
  excluded: Iterable<string> = [],
  random = Math.random,
) {
  const excludedSet = new Set(excluded);
  const available = UTANG_NICKNAME_ALIASES.filter(
    (nickname) => !excludedSet.has(nickname),
  );
  const choices = available.length ? available : UTANG_NICKNAME_ALIASES;
  if (!available.length) {
    for (let number = 1; number <= 999; number += 1) {
      const fallback = `${number}번타자 우땅이`;
      if (!excludedSet.has(fallback)) return fallback;
    }
    throw new Error('사용할 수 있는 우땅이 표시 이름이 없어.');
  }
  const index = Math.min(
    choices.length - 1,
    Math.floor(Math.max(0, random()) * choices.length),
  );
  return choices[index];
}

export async function ensureNicknameAlias(
  db: D1Database,
  originalNickname: string,
) {
  const existing = await db
    .prepare(
      'SELECT replacement_nickname replacementNickname, enabled FROM nickname_aliases WHERE original_nickname = ?',
    )
    .bind(originalNickname)
    .first<{ replacementNickname: string; enabled: number }>();
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const used = await db
      .prepare('SELECT replacement_nickname replacementNickname FROM nickname_aliases')
      .all<{ replacementNickname: string }>();
    const replacementNickname = pickUtangNickname(
      (used.results ?? []).map((row) => row.replacementNickname),
    );
    try {
      const inserted = await db
        .prepare(`INSERT OR IGNORE INTO nickname_aliases(
          original_nickname, replacement_nickname, enabled, updated_at
        ) VALUES (?, ?, 1, ?)`)
        .bind(originalNickname, replacementNickname, Date.now())
        .run();
      if (inserted.meta.changes)
        return { replacementNickname, enabled: 1 };
      const raced = await db
        .prepare(
          'SELECT replacement_nickname replacementNickname, enabled FROM nickname_aliases WHERE original_nickname = ?',
        )
        .bind(originalNickname)
        .first<{ replacementNickname: string; enabled: number }>();
      if (raced) return raced;
    } catch {
      // A different request may have claimed the same friendly alias.
    }
  }
  throw new Error('고유한 우땅이 표시 이름을 만들지 못했어.');
}
