import sharp from 'sharp';

const clear = { r: 0, g: 0, b: 0, alpha: 0 };

async function cutOut(source, output, width, height) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  const queue = [];
  const canRemove = (point) => {
    const offset = point * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
  };
  const add = (point) => {
    if (!visited[point] && canRemove(point)) {
      visited[point] = 1;
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
    if (x > 0) add(point - 1);
    if (x + 1 < info.width) add(point + 1);
    if (y > 0) add(point - info.width);
    if (y + 1 < info.height) add(point + info.width);
  }
  for (let point = 0; point < visited.length; point += 1) {
    if (visited[point]) data[point * 4 + 3] = 0;
  }
  const trimmed = await sharp(data, { raw: info }).trim({ background: clear }).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: clear } })
    .composite([{
      input: await sharp(trimmed).resize(width - 8, height - 8, { fit: 'contain', background: clear }).png().toBuffer(),
      gravity: 'centre',
    }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

await Promise.all([
  cutOut('assets/source/utang-sticker-heart-v120-source.jpg', 'public/utang-sticker-heart-v120.png', 320, 260),
  cutOut('assets/source/utang-sticker-ticket-v120-source.jpg', 'public/utang-sticker-ticket-v120.png', 260, 320),
]);

console.log('Built the v1.2.0 countdown sticker cutouts.');
