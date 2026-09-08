import sharp from 'sharp';

const variants = {
  gold: { dark: [177, 92, 5], mid: [239, 165, 18], light: [255, 245, 165], gloss: true },
  diamond: { dark: [68, 151, 207], light: [211, 244, 255] },
};
const frames = ['ready', 'load', 'stride', 'start', 'mid', 'contact', 'extension', 'follow'];
const batBoxes = {
  ready: [34, 20, 242, 350],
  load: [76, 70, 310, 360],
  stride: [106, 70, 300, 350],
  start: [55, 110, 305, 370],
  mid: [34, 330, 370, 510],
  contact: [350, 285, 638, 425],
  extension: [320, 260, 638, 425],
  follow: [350, 0, 540, 285],
};

function interpolate(a, b, amount) { return Math.round(a + (b - a) * amount); }
function isBatFill(r, g, b, a) {
  return a > 48 && r > 174 && g > 137 && b > 88 && r >= g - 14 && g >= b - 22;
}

function largestFillComponent(data, width, height, box) {
  const [left, top, right, bottom] = box;
  const mask = new Uint8Array(width * height);
  for (let y = top; y < Math.min(bottom, height); y += 1) {
    for (let x = left; x < Math.min(right, width); x += 1) {
      const offset = (y * width + x) * 4;
      if (isBatFill(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) mask[y * width + x] = 1;
    }
  }
  let largest = [];
  for (let y = top; y < Math.min(bottom, height); y += 1) {
    for (let x = left; x < Math.min(right, width); x += 1) {
      const start = y * width + x;
      if (mask[start] !== 1) continue;
      const component = [];
      const queue = [start];
      mask[start] = 2;
      while (queue.length) {
        const point = queue.pop();
        component.push(point);
        const px = point % width;
        const py = Math.floor(point / width);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = px + dx; const ny = py + dy;
            if (nx < left || nx >= right || ny < top || ny >= bottom || nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (mask[next] === 1) { mask[next] = 2; queue.push(next); }
          }
        }
      }
      if (component.length > largest.length) largest = component;
    }
  }
  if (largest.length < 120) throw new Error(`Could not isolate bat fill (${largest.length} pixels)`);
  return largest;
}

async function recolorBat(source, output, box, palette) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const component = largestFillComponent(data, info.width, info.height, box);
  let glossGeometry = null;
  if (palette.gloss) {
    let centerX = 0; let centerY = 0;
    for (const point of component) { centerX += point % info.width; centerY += Math.floor(point / info.width); }
    centerX /= component.length; centerY /= component.length;
    let xx = 0; let yy = 0; let xy = 0;
    for (const point of component) {
      const dx = point % info.width - centerX; const dy = Math.floor(point / info.width) - centerY;
      xx += dx * dx; yy += dy * dy; xy += dx * dy;
    }
    const angle = .5 * Math.atan2(2 * xy, xx - yy);
    const majorX = Math.cos(angle); const majorY = Math.sin(angle);
    let minorX = -majorY; let minorY = majorX;
    if (minorY > 0) { minorX *= -1; minorY *= -1; }
    let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
    for (const point of component) {
      const dx = point % info.width - centerX; const dy = Math.floor(point / info.width) - centerY;
      const u = dx * majorX + dy * majorY; const v = dx * minorX + dy * minorY;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    glossGeometry = { centerX, centerY, majorX, majorY, minorX, minorY, minU, maxU, minV, maxV };
  }
  for (const point of component) {
    const offset = point * 4;
    const lightness = Math.max(0, Math.min(1, (data[offset] + data[offset + 1] + data[offset + 2] - 430) / 330));
    if (palette.mid) {
      // Preserve the original pencil shading, but increase contrast so gold reads
      // as polished metal even at the small in-game sprite size.
      const highlight = Math.pow(lightness, 0.72);
      const from = highlight < 0.55 ? palette.dark : palette.mid;
      const to = highlight < 0.55 ? palette.mid : palette.light;
      const amount = highlight < 0.55 ? highlight / 0.55 : (highlight - 0.55) / 0.45;
      data[offset] = interpolate(from[0], to[0], amount);
      data[offset + 1] = interpolate(from[1], to[1], amount);
      data[offset + 2] = interpolate(from[2], to[2], amount);
      const x = point % info.width; const y = Math.floor(point / info.width);
      const u = (x - glossGeometry.centerX) * glossGeometry.majorX + (y - glossGeometry.centerY) * glossGeometry.majorY;
      const v = (x - glossGeometry.centerX) * glossGeometry.minorX + (y - glossGeometry.centerY) * glossGeometry.minorY;
      const uNorm = (u - glossGeometry.minU) / (glossGeometry.maxU - glossGeometry.minU || 1);
      const vNorm = (v - glossGeometry.minV) / (glossGeometry.maxV - glossGeometry.minV || 1);
      const stripe = uNorm > .12 && uNorm < .83 && vNorm > .64 && vNorm < .79;
      if (stripe) {
        const strength = .48 * Math.sin(((vNorm - .64) / .15) * Math.PI);
        data[offset] = interpolate(data[offset], 255, strength);
        data[offset + 1] = interpolate(data[offset + 1], 247, strength);
        data[offset + 2] = interpolate(data[offset + 2], 185, strength);
      }
    } else {
      data[offset] = interpolate(palette.dark[0], palette.light[0], lightness);
      data[offset + 1] = interpolate(palette.dark[1], palette.light[1], lightness);
      data[offset + 2] = interpolate(palette.dark[2], palette.light[2], lightness);
    }
  }
  const result = await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
  if (output) await sharp(result).toFile(output);
  return result;
}

async function removeGeneratedBackdrop(source, output) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const background = new Uint8Array(info.width * info.height);
  const queue = [];
  const canRemove = (point) => {
    const offset = point * 4;
    const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
    return Math.min(r, g, b) > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
  };
  const add = (point) => { if (!background[point] && canRemove(point)) { background[point] = 1; queue.push(point); } };
  for (let x = 0; x < info.width; x += 1) { add(x); add((info.height - 1) * info.width + x); }
  for (let y = 0; y < info.height; y += 1) { add(y * info.width); add(y * info.width + info.width - 1); }
  while (queue.length) {
    const point = queue.pop(); const x = point % info.width; const y = Math.floor(point / info.width);
    if (x) add(point - 1); if (x + 1 < info.width) add(point + 1);
    if (y) add(point - info.width); if (y + 1 < info.height) add(point + info.width);
  }
  for (let point = 0; point < background.length; point += 1) if (background[point]) data[point * 4 + 3] = 0;
  const trimmed = await sharp(data, { raw: info }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 720, height: 260, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(trimmed).resize(680, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), gravity: 'centre' }])
    .png({ compressionLevel: 9 }).toFile(output);
}

await Promise.all([
  removeGeneratedBackdrop('assets/source/utang-bat-gold-v093-source.png', 'public/utang-bat-gold-v093.png'),
  removeGeneratedBackdrop('assets/source/utang-bat-diamond-v093-source.png', 'public/utang-bat-diamond-v093.png'),
]);

const goldSparkles = Buffer.from(`<svg width="720" height="260" xmlns="http://www.w3.org/2000/svg">
  <g fill="#fff7c7" stroke="#9f5b00" stroke-width="3" stroke-linejoin="round">
    <path d="M568 65c4 16 10 22 26 26-16 4-22 10-26 26-4-16-10-22-26-26 16-4 22-10 26-26z"/>
    <path d="M621 118c2 9 6 13 15 15-9 2-13 6-15 15-2-9-6-13-15-15 9-2 13-6 15-15z"/>
  </g>
</svg>`);
const decoratedGold = await sharp('public/utang-bat-gold-v093.png')
  .composite([{ input: goldSparkles }])
  .png({ compressionLevel: 9 })
  .toBuffer();
await sharp(decoratedGold).toFile('public/utang-bat-gold-v093.png');

for (const [variant, palette] of Object.entries(variants)) {
  const frameBuffers = [];
  for (const frame of frames) {
    const frameBuffer = await recolorBat(`public/utang-batter-v8-${frame}.png`, frame === 'follow' ? `public/utang-batter-v8-${variant}-follow.png` : null, batBoxes[frame], palette);
    frameBuffers.push(frameBuffer);
  }
  await recolorBat('public/utang-pose-miss-v071.png', `public/utang-pose-miss-v093-${variant}.png`, [0, 360, 310, 590], palette);
  const layers = await Promise.all(frameBuffers.map(async (frameBuffer, index) => ({
    input: await sharp(frameBuffer).resize(320, 288, { fit: 'fill' }).png().toBuffer(),
    left: index * 320,
    top: 0,
  })));
  await sharp({ create: { width: 2560, height: 288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 9 }).toFile(`public/utang-batter-v8-${variant}-strip.png`);
}

console.log('Built v0.9.3 bat assets.');
