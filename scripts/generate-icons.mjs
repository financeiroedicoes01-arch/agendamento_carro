import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
const svg = await readFile(new URL("../public/icon.svg", import.meta.url));
const dir = new URL("../public/icons/", import.meta.url);
await mkdir(dir, { recursive: true });
for (const size of [192, 512])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(
      new URL(`icon-${size}.png`, dir).pathname.replace(/^\/(\w:)/, "$1"),
    );
await sharp(svg)
  .resize(320, 320)
  .extend({ top: 96, bottom: 96, left: 96, right: 96, background: "#912c3a" })
  .png()
  .toFile(new URL("maskable-512.png", dir).pathname.replace(/^\/(\w:)/, "$1"));
