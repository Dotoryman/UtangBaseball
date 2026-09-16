import sharp from 'sharp';

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function normalizeTransparent(
  source,
  output,
  { removeChecker = false } = {},
) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (removeChecker) {
    const outside = new Uint8Array(info.width * info.height);
    const queue = [];
    const isBackdrop = (point) => {
      const offset = point * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      return (
        Math.max(r, g, b) - Math.min(r, g, b) < 18 && Math.min(r, g, b) > 105
      );
    };
    const add = (point) => {
      if (!outside[point] && isBackdrop(point)) {
        outside[point] = 1;
        queue.push(point);
      }
    };
    for (let x = 0; x < info.width; x += 1) {
      add(x);
      add((info.height - 1) * info.width + x);
    }
    for (let y = 0; y < info.height; y += 1) {
      add(y * info.width);
      add(y * info.width + info.width - 1);
    }
    while (queue.length) {
      const point = queue.pop();
      const x = point % info.width;
      const y = Math.floor(point / info.width);
      if (x) add(point - 1);
      if (x + 1 < info.width) add(point + 1);
      if (y) add(point - info.width);
      if (y + 1 < info.height) add(point + info.width);
    }
    for (let point = 0; point < outside.length; point += 1) {
      if (outside[point]) data[point * 4 + 3] = 0;
    }
  }

  const trimmed = await sharp(data, { raw: info })
    .trim({ background: transparent })
    .png()
    .toBuffer();
  const sprite = await sharp(trimmed)
    .resize(352, 352, { fit: 'contain', background: transparent })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 384, height: 384, channels: 4, background: transparent },
  })
    .composite([{ input: sprite, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function strengthenMiss(source, output) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 12) continue;

      // Prevent the dropped bat and pants from visually dissolving into the dirt.
      // Only antialiased interior pixels are strengthened; the outer canvas stays transparent.
      if ((y > 355 && x < 315) || (y > 330 && x > 205)) {
        data[offset + 3] = alpha > 42 ? 255 : Math.min(255, alpha * 3);
      }

      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (y > 330 && x > 205 && r > 178 && g > 178 && b > 178) {
        const shade = Math.max(0, Math.min(1, (r + g + b - 540) / 225));
        data[offset] = Math.round(218 + 35 * shade);
        data[offset + 1] = Math.round(228 + 27 * shade);
        data[offset + 2] = Math.round(240 + 15 * shade);
      }
    }
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
}

await sharp('assets/source/utang-stadium-v121-source.png')
  .resize(1024, 1536, { fit: 'cover' })
  .webp({ quality: 90 })
  .toFile('public/utang-stadium-v121.webp');

await Promise.all([
  normalizeTransparent(
    'assets/source/utang-umpire-v121-idle-source.png',
    'public/utang-umpire-v121-idle.png',
  ),
  normalizeTransparent(
    'assets/source/utang-umpire-v121-strike-source.png',
    'public/utang-umpire-v121-strike.png',
    { removeChecker: true },
  ),
  normalizeTransparent(
    'assets/source/utang-umpire-v121-fair-source.png',
    'public/utang-umpire-v121-fair.png',
    { removeChecker: true },
  ),
]);

await sharp({
  create: { width: 1152, height: 384, channels: 4, background: transparent },
})
  .composite(
    ['idle', 'strike', 'fair'].map((pose, index) => ({
      input: `public/utang-umpire-v121-${pose}.png`,
      left: index * 384,
      top: 0,
    })),
  )
  .png({ compressionLevel: 9 })
  .toFile('public/utang-umpire-v121-strip.png');

await Promise.all([
  strengthenMiss(
    'public/utang-pose-miss-v071.png',
    'public/utang-pose-miss-v121.png',
  ),
  ...['aluminum', 'gold', 'ruby', 'diamond'].map((bat) =>
    strengthenMiss(
      `old/public/utang-pose-miss-v093-${bat}.png`,
      `public/utang-pose-miss-v121-${bat}.png`,
    ),
  ),
]);

console.log('Built v1.2.1 hand-drawn art hotfix assets.');
