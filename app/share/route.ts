const ORIGIN = 'https://utangbaseball.cloud';

function safeNumber(value: string | null, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, Math.round(parsed))) : 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams;
  const nickname = (query.get('n') ?? query.get('name') ?? '우땅이').trim().slice(0, 10) || '우땅이';
  const score = safeNumber(query.get('s') ?? query.get('score'), 200_000);
  const homeRuns = safeNumber(query.get('h') ?? query.get('hr'), 10);
  const distance = safeNumber(query.get('d') ?? query.get('distance'), 200);
  const combo = safeNumber(query.get('x') ?? query.get('combo'), 20);
  const card = query.get('c') ?? query.get('card') ?? '';
  const hasCard = /^[0-9a-f-]{32,36}$/i.test(card);
  const image = hasCard
    ? `${ORIGIN}/api/share-card?id=${encodeURIComponent(card)}&v=72`
    : `${ORIGIN}/og-utangbaseball-v6.png`;
  const title = `${nickname}의 우땅야구 ${score.toLocaleString('ko-KR')}점!`;
  const description = `홈런 ${homeRuns}개 · 최고 비거리 ${distance}m · 최고 콤보 ×${combo}`;
  const canonicalUrl = `${ORIGIN}/share?${query.toString()}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeNickname = escapeHtml(nickname);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeImage = escapeHtml(image);

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeCanonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="우땅야구">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safeCanonicalUrl}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:type" content="${hasCard ? 'image/jpeg' : 'image/png'}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${safeNickname}의 우땅야구 점수 카드">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <style>
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;color:#4b2d21;background:linear-gradient(145deg,#f7e7c9,#d7ad7e);font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif}.card{width:min(100%,430px);padding:36px 24px 28px;text-align:center;background:rgba(255,250,239,.94);border:1px solid rgba(255,255,255,.8);border-radius:32px;box-shadow:0 24px 70px rgba(72,41,25,.22)}img{width:96px;height:96px;border-radius:50%;filter:drop-shadow(0 8px 8px rgba(69,39,23,.14))}p{margin:16px 0 3px;color:#8d5c41;font-weight:800}h1{margin:0 0 24px;font-size:50px;letter-spacing:-3px}h1 small{margin-left:4px;font-size:17px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:22px}.stats span{padding:12px 5px;color:#8a6855;background:#f4eadb;border-radius:13px;font-size:11px}.stats b{display:block;margin-top:5px;color:#5a3526;font-size:15px}a{display:flex;align-items:center;justify-content:center;min-height:58px;color:white;background:linear-gradient(135deg,#c8734f,#9e4c31);border-radius:17px;box-shadow:0 7px 0 #7f3927;text-decoration:none;font-size:19px;font-weight:900}a:active{transform:translateY(4px);box-shadow:0 3px 0 #7f3927}
  </style>
</head>
<body>
  <main class="card">
    <img src="${ORIGIN}/utang-sun-logo.png" alt="햇님 우땅이">
    <p>${safeNickname}의 우땅야구 기록</p>
    <h1>${score.toLocaleString('ko-KR')}<small>점</small></h1>
    <div class="stats"><span>홈런<b>${homeRuns}개</b></span><span>최고 비거리<b>${distance}m</b></span><span>최고 콤보<b>×${combo}</b></span></div>
    <a href="${ORIGIN}/?from=share">나도 PLAY BALL!</a>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
