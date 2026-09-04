import sharp from 'sharp';

const batterFrames = [
  'ready',
  'load',
  'stride',
  'start',
  'mid',
  'contact',
  'extension',
  'follow',
];

async function buildBatterStrip() {
  const frameWidth = 320;
  const frameHeight = 288;
  const layers = await Promise.all(
    batterFrames.map(async (name, index) => ({
      input: await sharp(`public/utang-batter-v8-${name}.png`)
        .resize(frameWidth, frameHeight, { fit: 'fill' })
        .png()
        .toBuffer(),
      left: frameWidth * index,
      top: 0,
    })),
  );

  await sharp({
    create: {
      width: frameWidth * batterFrames.length,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .webp({ lossless: true, effort: 6 })
    .toFile('public/utang-batter-v8-strip.webp');
}

async function buildShareCards() {
  await sharp('assets/source/utang-share-card-v4-source.png')
    .resize(1200, 630, { fit: 'fill' })
    .jpeg({ quality: 91, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile('public/utang-share-card-v4-bg.jpg');

  const overlay = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <style>
        .ko { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
        .en { font-family: Arial, sans-serif; }
      </style>
      <text x="105" y="168" class="en" font-size="23" font-weight="800" letter-spacing="3" fill="#ffcf45">UTANG BASEBALL</text>
      <text x="105" y="252" class="ko" font-size="66" font-weight="900" fill="#ffffff">우땅야구</text>
      <text x="108" y="307" class="ko" font-size="27" font-weight="700" fill="#c7ddfa">10개의 공으로 오늘의 우땅왕에 도전!</text>
      <line x1="105" y1="360" x2="735" y2="360" stroke="#ffffff" stroke-opacity=".2" stroke-width="2"/>
      <text x="105" y="431" class="ko" font-size="30" font-weight="800" fill="#ffffff">우땅이랑 같이, 한 방 날려볼까?</text>
      <text x="105" y="515" class="en" font-size="24" font-weight="800" fill="#ffcf45">utangbaseball.cloud</text>
    </svg>
  `);

  await sharp('public/utang-share-card-v4-bg.jpg')
    .composite([{ input: overlay }])
    .png({ compressionLevel: 9 })
    .toFile('public/og-utangbaseball-v4.png');

  const scorePreview = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <style>.ko{font-family:"Malgun Gothic",sans-serif}.en{font-family:Arial,sans-serif}</style>
      <text x="105" y="154" class="en" font-size="23" font-weight="900" fill="#ffcf45">UTANG BASEBALL · FINAL SCORE</text>
      <text x="105" y="211" class="ko" font-size="42" font-weight="900" fill="#fff">우땅이 선수의 10구 승부</text>
      <text x="100" y="325" class="en" font-size="98" font-weight="900" fill="#fff">52,272</text>
      <text x="466" y="321" class="ko" font-size="34" font-weight="900" fill="#ffcf45">점</text>
      <line x1="105" y1="354" x2="735" y2="354" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>
      <text x="105" y="397" class="ko" font-size="20" font-weight="800" fill="#b9d7ff">홈런</text>
      <text x="310" y="397" class="ko" font-size="20" font-weight="800" fill="#b9d7ff">최고 비거리</text>
      <text x="535" y="397" class="ko" font-size="20" font-weight="800" fill="#b9d7ff">최고 콤보</text>
      <text x="105" y="443" class="ko" font-size="34" font-weight="900" fill="#fff">5개</text>
      <text x="310" y="443" class="en" font-size="34" font-weight="900" fill="#fff">147m</text>
      <text x="535" y="443" class="en" font-size="34" font-weight="900" fill="#fff">×8</text>
      <text x="105" y="515" class="en" font-size="22" font-weight="800" fill="#ffcf45">utangbaseball.cloud</text>
    </svg>
  `);
  await sharp('public/utang-share-card-v4-bg.jpg')
    .composite([{ input: scorePreview }])
    .png({ compressionLevel: 9 })
    .toFile('artifacts/animation-qa/share-card-v4-preview.png');
}

async function extractPitcherFollow() {
  const pantsFill = Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <path d="M156 305 C220 303 292 299 351 318 C395 331 434 351 472 359 L466 382 C424 376 385 360 349 358 C315 370 278 414 238 474 L208 478 C207 436 196 391 172 352 Z" fill="#fffdf7"/>
    </svg>
  `);
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: pantsFill },
      { input: 'public/utang-pitcher-follow-authentic.png' },
    ])
    .png({ compressionLevel: 9 })
    .toFile('public/utang-pitcher-follow-v2.png');
}

await Promise.all([buildBatterStrip(), buildShareCards(), extractPitcherFollow()]);
console.log('Built v0.4.0 image assets.');
