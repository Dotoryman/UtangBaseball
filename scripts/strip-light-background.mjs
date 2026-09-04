import sharp from 'sharp';

const [inputPath, outputPath, thresholdArg = '218'] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/strip-light-background.mjs <input> <output> [threshold]');
}

const threshold = Number(thresholdArg);
const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;

function isBackground(pixelIndex) {
  const offset = pixelIndex * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return r >= threshold && g >= threshold && b >= threshold && Math.max(r, g, b) - Math.min(r, g, b) <= 28;
}

function enqueue(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const pixelIndex = y * width + x;
  if (visited[pixelIndex]) return;
  visited[pixelIndex] = 1;
  if (!isBackground(pixelIndex)) return;
  queue[tail++] = pixelIndex;
}

for (let x = 0; x < width; x += 1) {
  enqueue(x, 0);
  enqueue(x, height - 1);
}
for (let y = 0; y < height; y += 1) {
  enqueue(0, y);
  enqueue(width - 1, y);
}

while (head < tail) {
  const pixelIndex = queue[head++];
  const x = pixelIndex % width;
  const y = Math.floor(pixelIndex / width);
  data[pixelIndex * 4 + 3] = 0;
  enqueue(x - 1, y);
  enqueue(x + 1, y);
  enqueue(x, y - 1);
  enqueue(x, y + 1);
}

await sharp(data, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Removed ${tail.toLocaleString()} connected background pixels from ${inputPath}`);
