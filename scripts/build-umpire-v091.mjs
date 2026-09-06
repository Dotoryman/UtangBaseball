import sharp from 'sharp';
const poses = ['idle', 'strike', 'fair'];
// Identical crop and scale across poses: never individually trim gesture frames.
const layers = [];
for (const [index, pose] of poses.entries()) {
  const path = `public/utang-umpire-v091-${pose}.png`;
  const buffer = await sharp(path).extract({left:150,top:140,width:960,height:960}).resize(384,384).png().toBuffer();
  await sharp(buffer).toFile(path);
  layers.push({ input:buffer, left:index*384, top:0 });
}
await sharp({create:{width:1152,height:384,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile('public/utang-umpire-v091-strip.png');
