import sharp from 'sharp';

const targets = [
  { path: 'public/baseball-official-cutout.png', width: 256 },
  { path: 'public/utang-sun-logo.png', width: 512 },
];

for (const target of targets) {
  const temporary = `${target.path}.optimized`;
  await sharp(target.path)
    .resize({ width: target.width, height: target.width, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(temporary);
  await sharp(temporary).toFile(target.path);
  await import('node:fs/promises').then(({ unlink }) => unlink(temporary));
}
