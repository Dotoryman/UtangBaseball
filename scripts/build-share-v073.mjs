import sharp from 'sharp';

await sharp('assets/source/utang-share-card-v073-source.png')
  .resize(1200, 630)
  .flatten({ background: '#fff8e9' })
  .jpeg({ quality: 92 })
  .toFile('public/utang-share-card-v073-bg.jpg');
const overlay = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <style>
      .ko { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
      .en { font-family: Arial, sans-serif; }
    </style>
    <text x="105" y="168" class="en" font-size="23" font-weight="800" letter-spacing="3" fill="#e3b85c">UTANG BASEBALL</text>
    <text x="105" y="252" class="ko" font-size="66" font-weight="900" fill="#fff8e9">우땅야구</text>
    <text x="108" y="307" class="ko" font-size="27" font-weight="700" fill="#e7cba7">7개의 공으로 오늘의 우땅왕에 도전!</text>
    <line x1="105" y1="360" x2="735" y2="360" stroke="#fff4dc" stroke-opacity=".24" stroke-width="2"/>
    <text x="105" y="431" class="ko" font-size="30" font-weight="800" fill="#fff8e9">우땅이랑 같이, 한 방 날려볼까?</text>
    <text x="105" y="515" class="en" font-size="24" font-weight="800" fill="#e3b85c">utangbaseball.cloud</text>
  </svg>
`);
await sharp('public/utang-share-card-v073-bg.jpg')
  .composite([{ input: overlay }])
  .png({ compressionLevel: 9 })
  .toFile('public/og-utangbaseball-v120.png');
