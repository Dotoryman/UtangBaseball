# 배포 방식

## 구성

- 앱: vinext 기반 React 애플리케이션
- 실행 환경: Cloudflare Workers
- 정적 파일: Workers Static Assets
- 순위표: Cloudflare D1 (`DB` 바인딩)
- 소스 공개: GitHub 공개 저장소 `UtangBaseball`

## 첫 배포

1. `wrangler d1 create utang-baseball-scores`로 데이터베이스를 만든다.
2. 출력된 `database_id`를 `wrangler.jsonc`에 넣는다.
3. `npm run db:migrate`로 원격 스키마를 적용한다.
4. `npm run deploy`로 빌드 결과와 함께 Workers에 배포한다.

## 이후 릴리스

`v*` 태그를 GitHub에 푸시하거나 Actions에서 수동 실행하면 먼저 빌드를 검증합니다. 저장소에 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID` 시크릿이 설정되어 있으면 D1 마이그레이션과 Workers 배포까지 이어지고, 토큰이 없으면 안전하게 검증만 완료합니다.

## 도메인

`utangbaseball.cloud`는 구매 완료된 공식 도메인 후보입니다. 현재 릴리스에서는 연결하지 않으며, 소유자가 배포 후 별도로 요청할 때 Workers 커스텀 도메인으로 연결합니다.
