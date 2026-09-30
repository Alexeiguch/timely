// Derive native assets from the existing web logo; no separate artwork to maintain.
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", {
    paths: [
      require.resolve("next", {
        paths: [new URL("../apps/web", import.meta.url).pathname],
      }),
    ],
  }),
);
const source = await readFile(
  new URL("../apps/web/app/icon.svg", import.meta.url),
  "utf8",
);
const directory = new URL("../apps/mobile/assets/", import.meta.url);
await mkdir(directory, { recursive: true });
const render = (svg, file) => {
  const image = sharp(Buffer.from(svg)).resize(1024, 1024);
  return (file === "icon.png" ? image.removeAlpha() : image)
    .png()
    .toFile(new URL(file, directory).pathname);
};
// iOS masks its own corners; the full-bleed background must be opaque.
await render(source.replace('rx="16"', ""), "icon.png");
await render(source, "splash-icon.png");
// Android keeps the entire mark within its adaptive icon safe zone.
const foreground = source
  .replace(/  <rect[^>]+\/>\n/, "")
  .replace('viewBox="0 0 64 64"', 'viewBox="-22 -22 108 108"');
await render(foreground, "adaptive-icon.png");
await render(
  foreground.replaceAll("#1A5FCF", "#000000"),
  "monochrome-icon.png",
);
