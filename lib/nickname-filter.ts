export const NICKNAME_WARNING = '착한 우땅이는 예쁜 닉네임을 써요!';

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
};

export function normalizeNickname(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[013457]/g, (character) => LEET[character] ?? character)
    .replace(/[^\p{L}\p{N}\p{Script=Hangul}ㄱ-ㅎㅏ-ㅣ]/gu, '')
    .replace(/(.)\1{2,}/gu, '$1$1');
}

function variants(value: string) {
  const normalized = normalizeNickname(value);
  return [normalized, normalized.replace(/(.)\1+/gu, '$1')];
}

export function containsBannedWord(nickname: string, bannedWords: string[]) {
  const nicknameVariants = variants(nickname);
  return bannedWords.some((word) => {
    const wordVariants = variants(word);
    return nicknameVariants.some((candidate) =>
      wordVariants.some(
        (banned) => banned.length > 0 && candidate.includes(banned),
      ),
    );
  });
}

export async function validateNickname(db: D1Database, nickname: string) {
  const clean = nickname.trim() || '우땅이';
  if (clean.length > 10 || clean.length < 1)
    return { ok: false as const, error: '닉네임은 10글자 안으로 써줘!' };
  const result = await db
    .prepare('SELECT normalized_term FROM banned_words ORDER BY id')
    .all<{ normalized_term: string }>();
  const words = (result.results ?? []).map((row) => row.normalized_term);
  if (containsBannedWord(clean, words))
    return { ok: false as const, error: NICKNAME_WARNING };
  return { ok: true as const, nickname: clean };
}
