import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

await sharp('assets/source/utang-share-card-v073-source.png').resize(1200, 630).flatten({ background: '#fff8e9' }).jpeg({ quality: 92 }).toFile('public/utang-share-card-v073-bg.jpg');
// Reuse the established text coordinates, keeping the score area aligned.
const source = await readFile('scripts/build-v030-assets.mjs', 'utf8');
const overlay = source.match(/const overlay = Buffer\.from\(`([\s\S]*?)`\);/)[1];
await sharp('public/utang-share-card-v073-bg.jpg').composite([{ input: Buffer.from(overlay) }]).png().toFile('public/og-utangbaseball-v073.png');
