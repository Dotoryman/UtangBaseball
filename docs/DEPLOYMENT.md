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

`v*` 태그를 GitHub에 푸시하거나 Actions에서 수동 실행하면 빌드, D1 마이그레이션, Workers 배포가 순서대로 실행됩니다. 저장소에는 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID` 시크릿이 필요합니다.

## 도메인

`utangbaseball.cloud`는 구매 완료된 공식 도메인 후보입니다. 현재 릴리스에서는 연결하지 않으며, 소유자가 배포 후 별도로 요청할 때 Workers 커스텀 도메인으로 연결합니다.
