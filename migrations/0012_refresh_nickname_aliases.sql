DROP TABLE IF EXISTS nickname_reports;

DELETE FROM nickname_aliases;

WITH unique_names AS (
  SELECT nickname, ROW_NUMBER() OVER (ORDER BY MIN(played_at), nickname) position
  FROM scores
  GROUP BY nickname
)
INSERT INTO nickname_aliases(
  original_nickname, replacement_nickname, enabled, updated_at
)
SELECT nickname,
  CASE position
    WHEN 1 THEN '귀여운 우땅이'
    WHEN 2 THEN '용감한 우땅이'
    WHEN 3 THEN '씩씩한 우땅이'
    WHEN 4 THEN '신나는 우땅이'
    WHEN 5 THEN '졸린 우땅이'
    WHEN 6 THEN '배고픈 우땅이'
    WHEN 7 THEN '날쌘 우땅이'
    WHEN 8 THEN '엉뚱한 우땅이'
    WHEN 9 THEN '수줍은 우땅이'
    WHEN 10 THEN '당당한 우땅이'
    WHEN 11 THEN '야무진 우땅이'
    WHEN 12 THEN '행복한 우땅이'
    WHEN 13 THEN '행운의 우땅이'
    WHEN 14 THEN '홈런왕 우땅이'
    WHEN 15 THEN '안타왕 우땅이'
    WHEN 16 THEN '타격왕 우땅이'
    WHEN 17 THEN '도루왕 우땅이'
    WHEN 18 THEN '장타왕 우땅이'
    WHEN 19 THEN '역전왕 우땅이'
    WHEN 20 THEN '야구왕 우땅이'
    WHEN 21 THEN '번트왕 우땅이'
    WHEN 22 THEN '강속구 우땅이'
    WHEN 23 THEN '끝내기 우땅이'
    WHEN 24 THEN '만루포 우땅이'
    WHEN 25 THEN '직구왕 우땅이'
    WHEN 26 THEN '변화구 우땅이'
    WHEN 27 THEN '야구천재 우땅이'
    WHEN 28 THEN '타격천재 우땅이'
    WHEN 29 THEN '헛스윙 우땅이'
    WHEN 30 THEN '불방망이 우땅이'
    ELSE printf('%d번타자 우땅이', position - 30)
  END,
  1,
  unixepoch('now') * 1000
FROM unique_names;
