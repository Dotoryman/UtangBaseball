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

  const strip = sharp({
    create: {
      width: frameWidth * batterFrames.length,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(layers);

  await Promise.all([
    strip.clone().webp({ lossless: true, effort: 6 }).toFile('public/utang-batter-v8-strip.webp'),
    strip.clone().png({ compressionLevel: 9 }).toFile('public/utang-batter-v8-strip.png'),
  ]);
}

async function buildCharacterStrips() {
  const frameSize = 512;
  const build = async (sources, output) => {
    const layers = await Promise.all(sources.map(async (source, index) => ({
      input: await sharp(source).resize(frameSize, frameSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }).png().toBuffer(),
      left: index * frameSize,
      top: 0,
    })));
    await sharp({
      create: {
        width: frameSize * sources.length,
        height: frameSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite(layers).png({ compressionLevel: 9 }).toFile(output);
  };

  await Promise.all([
    build(['public/utang-pitcher-authentic.png', 'public/utang-pitcher-follow-v2.png'], 'public/utang-pitcher-v6-strip.png'),
    build(['public/utang-catcher-authentic.png', 'public/utang-catcher-catch-v4.png'], 'public/utang-catcher-v6-strip.png'),
  ]);
}

async function buildShareCards() {
  const warmBoard = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff3d8"/><stop offset="1" stop-color="#d9ae74"/></linearGradient><linearGradient id="board" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#573626"/><stop offset="1" stop-color="#352117"/></linearGradient></defs>
      <rect x="52" y="66" width="734" height="490" rx="48" fill="url(#frame)" stroke="#8c5938" stroke-width="5"/>
      <rect x="67" y="82" width="704" height="458" rx="38" fill="url(#board)" stroke="#d7a83c" stroke-width="3"/>
      <rect x="76" y="91" width="686" height="440" rx="31" fill="none" stroke="#fff0cc" stroke-opacity=".34" stroke-width="2"/>
    </svg>
  `);
  await sharp('assets/source/utang-share-card-v4-source.png')
    .resize(1200, 630, { fit: 'fill' })
    .composite([{ input: warmBoard }])
    .jpeg({ quality: 91, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile('public/utang-share-card-v6-bg.jpg');

  const overlay = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <style>
        .ko { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
        .en { font-family: Arial, sans-serif; }
      </style>
      <text x="105" y="168" class="en" font-size="23" font-weight="800" letter-spacing="3" fill="#e3b85c">UTANG BASEBALL</text>
      <text x="105" y="252" class="ko" font-size="66" font-weight="900" fill="#fff8e9">우땅야구</text>
      <text x="108" y="307" class="ko" font-size="27" font-weight="700" fill="#e7cba7">10개의 공으로 오늘의 우땅왕에 도전!</text>
      <line x1="105" y1="360" x2="735" y2="360" stroke="#fff4dc" stroke-opacity=".24" stroke-width="2"/>
      <text x="105" y="431" class="ko" font-size="30" font-weight="800" fill="#fff8e9">우땅이랑 같이, 한 방 날려볼까?</text>
      <text x="105" y="515" class="en" font-size="24" font-weight="800" fill="#e3b85c">utangbaseball.cloud</text>
    </svg>
  `);

  await sharp('public/utang-share-card-v6-bg.jpg')
    .composite([{ input: overlay }])
    .png({ compressionLevel: 9 })
    .toFile('public/og-utangbaseball-v6.png');

  const scorePreview = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <style>.ko{font-family:"Malgun Gothic",sans-serif}.en{font-family:Arial,sans-serif}</style>
      <text x="105" y="154" class="en" font-size="23" font-weight="900" fill="#e3b85c">UTANG BASEBALL · FINAL SCORE</text>
      <text x="105" y="211" class="ko" font-size="42" font-weight="900" fill="#fff8e9">우땅이 선수의 10구 승부</text>
      <text x="100" y="325" class="en" font-size="98" font-weight="900" fill="#fff8e9">52,272</text>
      <text x="466" y="321" class="ko" font-size="34" font-weight="900" fill="#e3b85c">점</text>
      <line x1="105" y1="354" x2="735" y2="354" stroke="#fff4dc" stroke-opacity=".22" stroke-width="2"/>
      <text x="105" y="397" class="ko" font-size="20" font-weight="800" fill="#e7cba7">홈런</text>
      <text x="310" y="397" class="ko" font-size="20" font-weight="800" fill="#e7cba7">최고 비거리</text>
      <text x="535" y="397" class="ko" font-size="20" font-weight="800" fill="#e7cba7">최고 콤보</text>
      <text x="105" y="443" class="ko" font-size="34" font-weight="900" fill="#fff8e9">5개</text>
      <text x="310" y="443" class="en" font-size="34" font-weight="900" fill="#fff8e9">147m</text>
      <text x="535" y="443" class="en" font-size="34" font-weight="900" fill="#fff8e9">×8</text>
      <text x="105" y="515" class="en" font-size="22" font-weight="800" fill="#e3b85c">utangbaseball.cloud</text>
    </svg>
  `);
  await sharp('public/utang-share-card-v6-bg.jpg')
    .composite([{ input: scorePreview }])
    .png({ compressionLevel: 9 })
    .toFile('artifacts/animation-qa/share-card-v6-preview.png');
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

async function buildStadiumV5() {
  await sharp('assets/source/utang-stadium-v5-source.png')
    .resize(1024, 1536, { fit: 'fill' })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile('public/utang-stadium-v5.webp');
}

await extractPitcherFollow();
await Promise.all([buildBatterStrip(), buildCharacterStrips(), buildShareCards(), buildStadiumV5()]);
console.log('Built v0.6.0 image assets.');
