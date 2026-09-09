export const UTANG_NICKNAME_ALIASES = [
  '용기있는 우땅이',
  '발빠른 우땅이',
  '씩씩한 우땅이',
  '다정한 우땅이',
  '신나는 우땅이',
  '야무진 우땅이',
  '재빠른 우땅이',
  '든든한 우땅이',
  '귀여운 우땅이',
  '엉뚱한 우땅이',
  '멋쟁이 우땅이',
  '힘찬 우땅이',
  '홈런치는 우땅이',
  '공잘보는 우땅이',
  '행운가득 우땅이',
  '방망이든 우땅이',
  '공을보는 우땅이',
  '달려가는 우땅이',
  '기운찬 우땅이',
  '침착한 우땅이',
  '웃음가득 우땅이',
  '오늘도뜬 우땅이',
  '끝까지본 우땅이',
  '한방노린 우땅이',
  '안타치는 우땅이',
  '홈런왕 우땅이',
  '안타왕 우땅이',
  '도루왕 우땅이',
  '변화구왕 우땅이',
  '끝내기왕 우땅이',
  '만루포왕 우땅이',
  '야구천재 우땅이',
  '승리요정 우땅이',
  '수비요정 우땅이',
  '응원단장 우땅이',
  '직구보는 우땅이',
  '공잡는 우땅이',
  '배트드는 우땅이',
  '담장넘긴 우땅이',
  '끝까지뛴 우땅이',
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
  const index = Math.min(
    choices.length - 1,
    Math.floor(Math.max(0, random()) * choices.length),
  );
  return choices[index];
}
