import type { Metadata } from 'next';
import Link from 'next/link';

/* oxlint-disable next/no-img-element */

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function number(value: string | string[] | undefined, max: number) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, Math.round(parsed))) : 0;
}
function details(params: Params) {
  const nickname = (first(params.name)?.trim() || '우땅이').slice(0, 10);
  return {
    nickname,
    score: number(params.score, 200_000),
    homeRuns: number(params.hr, 10),
    distance: number(params.distance, 200),
    combo: number(params.combo, 20),
    card: first(params.card) ?? '',
  };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const result = details(await searchParams);
  const title = `${result.nickname}의 우땅야구 ${result.score.toLocaleString('ko-KR')}점!`;
  const description = `홈런 ${result.homeRuns}개 · 최고 비거리 ${result.distance}m · 최고 콤보 ×${result.combo}`;
  const image = /^[0-9a-f-]{32,36}$/i.test(result.card) ? `/api/share-card?id=${encodeURIComponent(result.card)}&v=7` : '/og-utangbaseball-v6.png';
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: [{ url: image, width: 1200, height: 630, alt: `${result.nickname}의 우땅야구 점수 카드` }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function SharePage({ searchParams }: { searchParams: Promise<Params> }) {
  const result = details(await searchParams);
  return <main className="share-page"><section className="share-summary">
    <img src="/utang-sun-logo.png" width={92} height={92} alt="햇님 우땅이" />
    <p>{result.nickname}의 우땅야구 기록</p>
    <h1>{result.score.toLocaleString('ko-KR')}<small>점</small></h1>
    <div><span>홈런 <b>{result.homeRuns}개</b></span><span>최고 비거리 <b>{result.distance}m</b></span><span>최고 콤보 <b>×{result.combo}</b></span></div>
    <Link href="/">나도 PLAY BALL!</Link>
  </section></main>;
}
