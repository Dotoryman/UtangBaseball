# UtangBaseball · 우땅야구

스마트폰 화면에 맞춘 10구 타이밍 야구 게임입니다. 닉네임 없이도 기본 이름 `우땅이`로 바로 시작할 수 있으며, 모바일 탭·PC 클릭·스페이스바를 지원합니다.

## v0.1 기능

- 직구·커브·체인지업 10구 승부
- MISS·FOUL·GOOD·PERFECT·HOME RUN별 우땅이 전용 포즈
- 콤보, 점수, 홈런 수, 최고 비거리
- Cloudflare D1 공용 순위표와 브라우저 로컬 백업
- 375px부터 430px까지의 모바일 우선 화면
- Cloudflare Workers 배포 구성

## 로컬 실행

```bash
npm ci
npm run db:migrate:local
npm run dev
```

## 검증

```bash
npm run typecheck
npm run lint
npm run build
```

배포와 D1 운영 절차는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)에 정리되어 있습니다.

> `utangbaseball.cloud`는 확보된 향후 공식 도메인이지만, 소유자의 별도 요청 전까지 연결하지 않습니다.
