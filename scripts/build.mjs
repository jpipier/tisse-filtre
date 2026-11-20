// Construit l'extension dans extension/dist (à charger « non empaquetée » dans chrome://extensions).
import { build } from "rolldown";
import sharp from "sharp";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist`;
const entries = ["page-hook", "content", "background", "popup"];

await rm(dist, { recursive: true, force: true });
await mkdir(`${dist}/icons`, { recursive: true });

for (const name of entries) {
  await build({
    input: `${root}src/${name}.ts`,
    output: { file: `${dist}/${name}.js`, format: "iife" },
    logLevel: "warn",
  });
}

const manifest = JSON.parse(await readFile(`${root}static/manifest.json`, "utf8"));
for (const script of manifest.content_scripts) script.matches = manifest.host_permissions;
await writeFile(`${dist}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of ["content.css", "popup.html", "popup.css"]) await cp(`${root}static/${file}`, `${dist}/${file}`);
await cp(`${root}static/_locales`, `${dist}/_locales`, { recursive: true });
const svg = await readFile(`${root}static/icon.svg`);
for (const size of [16, 32, 48, 128]) await sharp(svg, { density: 300 }).resize(size, size).png().toFile(`${dist}/icons/${size}.png`);

console.log(`Extension construite dans ${dist}`);
