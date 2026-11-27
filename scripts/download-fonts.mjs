import { mkdir, writeFile } from "node:fs/promises";
const dir = new URL("../public/fonts/", import.meta.url);
await mkdir(dir, { recursive: true });
const assets = {
  "outfit-400.ttf":
    "https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4E.ttf",
  "outfit-600.ttf":
    "https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4e6yC4E.ttf",
  "gabarito-600.ttf":
    "https://fonts.gstatic.com/s/gabarito/v9/QGYwz_0dZAGKJJ4t3FFkc3Q8AkNP9Pj2PcW0Fg.ttf",
  "gabarito-700.ttf":
    "https://fonts.gstatic.com/s/gabarito/v9/QGYwz_0dZAGKJJ4t3FFkc3Q8AkNP9Pj2BMW0Fg.ttf",
  "OFL-Outfit.txt":
    "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/OFL.txt",
  "OFL-Gabarito.txt":
    "https://raw.githubusercontent.com/google/fonts/main/ofl/gabarito/OFL.txt",
};
for (const [name, url] of Object.entries(assets)) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  await writeFile(new URL(name, dir), Buffer.from(await r.arrayBuffer()));
}
