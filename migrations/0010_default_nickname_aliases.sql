WITH unique_names AS (
  SELECT nickname, ROW_NUMBER() OVER (ORDER BY MIN(played_at), nickname) position
  FROM scores
  GROUP BY nickname
)
INSERT OR IGNORE INTO nickname_aliases(
  original_nickname, replacement_nickname, enabled, updated_at
)
SELECT nickname,
  CASE position
    WHEN 1 THEN '용기있는 우땅이'
    WHEN 2 THEN '발빠른 우땅이'
    WHEN 3 THEN '씩씩한 우땅이'
    WHEN 4 THEN '다정한 우땅이'
    WHEN 5 THEN '신나는 우땅이'
    WHEN 6 THEN '야무진 우땅이'
    WHEN 7 THEN '재빠른 우땅이'
    WHEN 8 THEN '든든한 우땅이'
    WHEN 9 THEN '귀여운 우땅이'
    WHEN 10 THEN '엉뚱한 우땅이'
    WHEN 11 THEN '멋쟁이 우땅이'
    WHEN 12 THEN '힘찬 우땅이'
    WHEN 13 THEN '홈런치는 우땅이'
    WHEN 14 THEN '공잘보는 우땅이'
    WHEN 15 THEN '행운가득 우땅이'
    WHEN 16 THEN '방망이든 우땅이'
    WHEN 17 THEN '공을보는 우땅이'
    WHEN 18 THEN '달려가는 우땅이'
    WHEN 19 THEN '기운찬 우땅이'
    WHEN 20 THEN '침착한 우땅이'
    WHEN 21 THEN '웃음가득 우땅이'
    WHEN 22 THEN '오늘도뜬 우땅이'
    WHEN 23 THEN '끝까지본 우땅이'
    WHEN 24 THEN '한방노린 우땅이'
    WHEN 25 THEN '안타치는 우땅이'
    WHEN 26 THEN '홈런왕 우땅이'
    WHEN 27 THEN '안타왕 우땅이'
    WHEN 28 THEN '도루왕 우땅이'
    WHEN 29 THEN '변화구왕 우땅이'
    WHEN 30 THEN '끝내기왕 우땅이'
    WHEN 31 THEN '만루포왕 우땅이'
    WHEN 32 THEN '야구천재 우땅이'
    WHEN 33 THEN '승리요정 우땅이'
    WHEN 34 THEN '수비요정 우땅이'
    WHEN 35 THEN '응원단장 우땅이'
    WHEN 36 THEN '직구보는 우땅이'
    WHEN 37 THEN '공잡는 우땅이'
    WHEN 38 THEN '배트드는 우땅이'
    WHEN 39 THEN '담장넘긴 우땅이'
    WHEN 40 THEN '끝까지뛴 우땅이'
    ELSE printf('%d번타자 우땅이', position - 40)
  END,
  1,
  unixepoch('now') * 1000
FROM unique_names;
