import sharp from 'sharp';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node scripts/extract-batter-reference.mjs <source> <output>');

const { data, info } = await sharp(source)
  .extract({ left: 690, top: 820, width: 570, height: 605 })
  .flop()
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const background = new Uint8Array(width * height);
const barrier = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;

const isBackground = (index) => {
  const offset = index * channels;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return Math.min(r, g, b) > 224 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
};

for (let index = 0; index < width * height; index++) {
  if (!isBackground(index)) barrier[index] = 1;
}
const closedBarrier = barrier.slice();
for (let index = 0; index < width * height; index++) {
  if (!barrier[index]) continue;
  const x = index % width;
  const y = Math.floor(index / width);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height && dx * dx + dy * dy <= 9) {
        closedBarrier[nextY * width + nextX] = 1;
      }
    }
  }
}

const enqueue = (index) => {
  if (!background[index] && !closedBarrier[index]) {
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
  data[index * channels + 3] = background[index] ? 0 : 255;
}

const visited = new Uint8Array(width * height);
let largest = [];
for (let start = 0; start < width * height; start++) {
  if (visited[start] || data[start * channels + 3] === 0) continue;
  const component = [];
  const componentQueue = [start];
  visited[start] = 1;
  for (let cursor = 0; cursor < componentQueue.length; cursor++) {
    const index = componentQueue[cursor];
    component.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
    for (const next of neighbors) {
      if (next >= 0 && !visited[next] && data[next * channels + 3] !== 0) {
        visited[next] = 1;
        componentQueue.push(next);
      }
    }
  }
  if (component.length > largest.length) largest = component;
}

const keep = new Uint8Array(width * height);
for (const index of largest) keep[index] = 1;
for (let index = 0; index < width * height; index++) {
  if (!keep[index]) data[index * channels + 3] = 0;
}

const trimmed = await sharp(data, { raw: info }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const normalized = await sharp(trimmed)
  .resize(500, 470, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toBuffer();
const normalizedMetadata = await sharp(normalized).metadata();
await sharp({ create: { width: 640, height: 576, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{
    input: normalized,
    left: Math.floor((640 - normalizedMetadata.width) / 2),
    top: 560 - normalizedMetadata.height,
  }])
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log(output);
