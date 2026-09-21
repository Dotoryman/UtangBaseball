import sharp from 'sharp';

const source = 'assets/source/utang-pose-foul-uniform-source.png';
const baseOutput = 'public/utang-pose-foul-uniform.png';
const variants = {
  aluminum: {
    dark: [91, 103, 116],
    mid: [174, 190, 205],
    light: [247, 252, 255],
  },
  gold: {
    dark: [170, 88, 4],
    mid: [239, 166, 18],
    light: [255, 244, 157],
  },
  ruby: {
    dark: [119, 10, 34],
    mid: [211, 31, 64],
    light: [255, 174, 186],
  },
  diamond: {
    dark: [55, 139, 195],
    mid: [109, 201, 236],
    light: [222, 249, 255],
  },
};

function interpolate(a, b, amount) {
  return Math.round(a + (b - a) * amount);
}

function isWoodFill(r, g, b, a) {
  return (
    a > 48 &&
    r > 164 &&
    g > 125 &&
    b > 72 &&
    r - g > 7 &&
    g - b > 8
  );
}

function findBatFill(data, width, height) {
  const [left, top, right, bottom] = [45, 366, 346, 470];
  const mask = new Uint8Array(width * height);
  for (let y = top; y < Math.min(bottom, height); y += 1) {
    for (let x = left; x < Math.min(right, width); x += 1) {
      const point = y * width + x;
      const offset = point * 4;
      if (
        isWoodFill(
          data[offset],
          data[offset + 1],
          data[offset + 2],
          data[offset + 3],
        )
      ) {
        mask[point] = 1;
      }
    }
  }

  const components = [];
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
            const nx = px + dx;
            const ny = py + dy;
            if (
              nx < left ||
              nx >= right ||
              ny < top ||
              ny >= bottom ||
              nx < 0 ||
              nx >= width ||
              ny < 0 ||
              ny >= height
            ) {
              continue;
            }
            const next = ny * width + nx;
            if (mask[next] === 1) {
              mask[next] = 2;
              queue.push(next);
            }
          }
        }
      }
      if (component.length > 45) components.push(component);
    }
  }
  components.sort((a, b) => b.length - a.length);
  const selected = components.slice(0, 2).flat();
  if (selected.length < 900) {
    throw new Error(`Could not isolate the dropped bat (${selected.length} pixels)`);
  }
  return selected;
}

const base = await sharp(source)
  .resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toBuffer();
await sharp(base).toFile(baseOutput);

const { data: baseData, info } = await sharp(base)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const batFill = findBatFill(baseData, info.width, info.height);

for (const [name, palette] of Object.entries(variants)) {
  const data = Buffer.from(baseData);
  for (const point of batFill) {
    const offset = point * 4;
    const brightness = Math.max(
      0,
      Math.min(1, (data[offset] + data[offset + 1] + data[offset + 2] - 430) / 320),
    );
    const from = brightness < 0.55 ? palette.dark : palette.mid;
    const to = brightness < 0.55 ? palette.mid : palette.light;
    const amount =
      brightness < 0.55 ? brightness / 0.55 : (brightness - 0.55) / 0.45;
    data[offset] = interpolate(from[0], to[0], amount);
    data[offset + 1] = interpolate(from[1], to[1], amount);
    data[offset + 2] = interpolate(from[2], to[2], amount);
  }
  await sharp(data, { raw: info })
    .png({ compressionLevel: 9 })
    .toFile(`public/utang-pose-foul-uniform-${name}.png`);
}

console.log('Built uniform foul pose with all five bat colors.');
