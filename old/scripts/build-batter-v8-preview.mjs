import sharp from 'sharp';

const names = ['ready', 'load', 'stride', 'start', 'mid', 'contact', 'extension', 'follow'];
const width = 640;
const pageHeight = 576;
const pages = [];

for (const name of names) {
  pages.push(await sharp(`public/utang-batter-v8-${name}.png`)
    .ensureAlpha()
    .raw()
    .toBuffer());
}

await sharp(Buffer.concat(pages), {
  raw: {
    width,
    height: pageHeight * pages.length,
    channels: 4,
    pageHeight,
  },
})
  .gif({
    delay: [360, 100, 85, 70, 55, 65, 85, 420],
    loop: 0,
    colours: 256,
    dither: 0.6,
    effort: 7,
  })
  .toFile('public/utang-batter-v8-preview.gif');

console.log('public/utang-batter-v8-preview.gif');
