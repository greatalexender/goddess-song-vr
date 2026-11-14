import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const src = '/home/hatch/workspace/goals/goal-4/references/song-pavilion-lotus-pond-key-visual-2026-11-13.jpg';
const meta = await sharp(src).metadata();
console.log('source', meta.width, meta.height);
// Square crop centred on the pavilion (centre ~54% x, ~42% y of frame).
const side = Math.floor(meta.height * 0.92);
const left = Math.min(Math.floor(meta.width * 0.54 - side / 2), meta.width - side);
const top = Math.floor((meta.height - side) / 2);
await mkdir('public/icons', { recursive: true });
const base = sharp(src).extract({ left: Math.max(left, 0), top, width: side, height: side });
await base.clone().resize(512, 512).png().toFile('public/icons/icon-512.png');
await base.clone().resize(192, 192).png().toFile('public/icons/icon-192.png');
// Maskable: full-bleed opaque, pavilion kept inside the ~80% safe zone via a wider crop.
const mSide = meta.height;
const mLeft = Math.min(Math.floor(meta.width * 0.54 - mSide / 2), meta.width - mSide);
await sharp(src).extract({ left: Math.max(mLeft, 0), top: 0, width: mSide, height: mSide })
  .resize(512, 512).png().toFile('public/icons/icon-512-maskable.png');
console.log('icons done');
