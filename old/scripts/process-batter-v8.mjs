import sharp from 'sharp';

const generatedRoot = process.env.UTANG_GENERATED_IMAGES_ROOT;
if (!generatedRoot) {
  throw new Error('Set UTANG_GENERATED_IMAGES_ROOT to the generated frame directory.');
}
const frames = [
  [`${generatedRoot}/exec-27fa6aa7-5e1b-4cb2-86b7-539277020ab3.png`, 'public/utang-batter-v8-load.png', 'magenta', 0.94],
  [`${generatedRoot}/exec-8070a16c-e257-4080-b8f5-0f595bab3ab7.png`, 'public/utang-batter-v8-stride.png', 'magenta', 0.94],
  [`${generatedRoot}/exec-df1fbcff-43a8-4c0c-9902-1c71dcb73afb.png`, 'public/utang-batter-v8-start.png', 'magenta', 0.98],
  [`${generatedRoot}/exec-647c6371-2c59-4704-955a-31bc20e21b40.png`, 'public/utang-batter-v8-mid.png', 'magenta', 1],
  [`${generatedRoot}/exec-cb9f95d1-d103-4ea7-b66c-20ea8fca51ca.png`, 'public/utang-batter-v8-contact.png', 'magenta', 1.25],
  [`${generatedRoot}/exec-79711e30-0cf6-4e96-addb-a4243b9e2cb2.png`, 'public/utang-batter-v8-extension.png', 'magenta', 1.28],
  [`${generatedRoot}/exec-d34b37ae-2eb6-478e-9ab2-43668e96addb.png`, 'public/utang-batter-v8-follow.png', 'magenta', 1.1],
];

for (const [source, output, backgroundType, scale] of frames) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const background = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBackground = (index) => {
    const offset = index * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (backgroundType === 'checker') {
      return Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
    }
    return r > 35 && b > 35 && Math.min(r - g, b - g) > 12;
  };

  const enqueue = (index) => {
    if (!background[index] && isBackground(index)) {
      background[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  for (let index = 0; index < width * height; index++) {
    const alphaOffset = index * channels + 3;
    data[alphaOffset] = background[index] || (backgroundType === 'magenta' && isBackground(index)) ? 0 : 255;
  }

  const cleaned = await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const base = await sharp(cleaned)
    .resize(476, 476, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  const baseMetadata = await sharp(base).metadata();
  const normalized = await sharp(base)
    .resize(Math.round(baseMetadata.width * scale), Math.round(baseMetadata.height * scale), { fit: 'fill' })
    .png()
    .toBuffer();
  const metadata = await sharp(normalized).metadata();
  const left = Math.floor((640 - metadata.width) / 2);
  const top = 560 - metadata.height;
  await sharp({ create: { width: 640, height: 576, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: normalized, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(output);
}

const reviewFrames = [
  ['public/utang-batter-v8-ready.png', '1  READY'],
  ['public/utang-batter-v8-load.png', '2  LOAD'],
  ['public/utang-batter-v8-stride.png', '3  STRIDE'],
  ['public/utang-batter-v8-start.png', '4  START'],
  ['public/utang-batter-v8-mid.png', '5  MID'],
  ['public/utang-batter-v8-contact.png', '6  CONTACT'],
  ['public/utang-batter-v8-extension.png', '7  EXTEND'],
  ['public/utang-batter-v8-follow.png', '8  FOLLOW'],
];
const reviewComposites = [];
for (let index = 0; index < reviewFrames.length; index++) {
  const [file, label] = reviewFrames[index];
  const column = index % 4;
  const row = Math.floor(index / 4);
  const left = 30 + column * 335;
  const top = 92 + row * 340;
  const image = await sharp(file).resize(306, 282, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
  reviewComposites.push({ input: image, left, top: top + 22 });
  reviewComposites.push({
    input: Buffer.from(`<svg width="306" height="32"><text x="153" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#0b2b58">${label}</text></svg>`),
    left,
    top: top + 295,
  });
}
const cardBackground = Buffer.from(`<svg width="1400" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="1400" height="800" fill="#f4efe5"/>
  <text x="700" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#0b2b58">UTANG BATTING · 8 FRAME REVIEW</text>
  ${Array.from({ length: 8 }, (_, index) => {
    const x = 30 + (index % 4) * 335;
    const y = 92 + Math.floor(index / 4) * 340;
    return `<rect x="${x}" y="${y}" width="306" height="326" rx="22" fill="#fffdf7" stroke="#143c72" stroke-width="3"/>`;
  }).join('')}
</svg>`);
await sharp(cardBackground).composite(reviewComposites).png({ compressionLevel: 9 }).toFile('public/utang-batter-v8-review.png');
console.log('public/utang-batter-v8-review.png');
