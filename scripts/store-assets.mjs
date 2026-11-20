// Génère les visuels de la fiche Chrome Web Store (captures 1280×800 FR/EN, vignette 440×280).
// Illustrations dessinées : aucune image d'épingle réelle n'est reprise.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}store`;

const C = {
  bg: "#faf6f0",
  ink: "#2f241c",
  muted: "#7d6d60",
  accent: "#7a4b2a",
  line: "#e8dfd3",
  card: "#ffffff",
};
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
const MONO = "Menlo, monospace";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const T = {
  fr: {
    s1: ["Pinterest,", "sans pubs", "ni images IA"],
    s1sub: ["Les épingles sponsorisées et les images", "générées par IA sont voilées ou retirées."],
    s2: ["Chaque décision", "expliquée"],
    s2sub: ["Le mode debug détaille les indices :", "dimensions, mots-clés, labels, signalements."],
    s3: ["Vous gardez", "la main"],
    s3sub: ["Voile ou retrait complet, signalement en un clic,", "« vraie photo » pour corriger une erreur."],
    ai: "Image IA probable",
    ad: "Publicité masquée",
    why: "dimensions de générateur",
    show: "Afficher",
    real: "C'est une vraie photo",
    debug: [
      ["IA", "#ffb38a"],
      ["✘ Pas de label IA Pinterest", null],
      ["✔ Mot-clé IA : « Midjourney »", null],
      ["✔ Dimensions : PNG 1024×1536,", null],
      ["   taille native de OpenAI", null],
      ["Données : réponse de Pinterest", null],
    ],
    debug2: [
      ["RIEN À MASQUER", "#9be0a8"],
      ["✘ Pas de label IA Pinterest", null],
      ["✘ Aucun mot-clé IA", null],
      ["✘ Dimensions : JPG 3024×4032,", null],
      ["   taille ordinaire", null],
    ],
    popupTitle: "Pinterest sans pub ni IA",
    stats: ["pubs masquées", "images IA masquées"],
    options: [
      "Masquer les publicités",
      "Masquer les images générées par IA",
      "Activer d'office le filtre « Moins d'IA »",
      "Repérer les dimensions des générateurs",
    ],
    modes: ["Voile flouté, avec « Afficher »", "Retirer complètement, sans trou"],
    report: "IA ?",
    promo: ["Pinterest sans pub", "ni images IA"],
  },
  // L'interface de l'extension n'existe qu'en français : seuls les titres des visuels sont traduits.
  en: {
    s1: ["Pinterest,", "without ads", "or AI images"],
    s1sub: ["Promoted pins and AI-generated images", "are veiled or removed (interface in French)."],
    s2: ["Every decision", "explained"],
    s2sub: ["Debug mode details the clues:", "dimensions, keywords, labels, reports."],
    s3: ["You stay", "in control"],
    s3sub: ["Veil or full removal, one-click reporting,", "“real photo” to fix a mistake."],
    promo: ["Pinterest without ads", "or AI images"],
  },
};

// L'anglais reprend l'interface française et ne traduit que les titres.
T.en = { ...T.fr, ...T.en };

// ---------- Briques ----------

function photoTile(x, y, w, h, hue, seed) {
  // « photo » abstraite : dégradé chaud, fenêtre, meuble, plante
  const id = `g${seed}`;
  return `
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="hsl(${hue},35%,88%)"/><stop offset="1" stop-color="hsl(${hue},30%,72%)"/>
  </linearGradient></defs>
  <g transform="translate(${x},${y})">
    <rect width="${w}" height="${h}" rx="18" fill="url(#${id})"/>
    <rect x="${w * 0.12}" y="${h * 0.1}" width="${w * 0.3}" height="${h * 0.38}" rx="6" fill="hsl(${hue},40%,95%)" opacity=".9"/>
    <rect x="${w * 0.1}" y="${h * 0.62}" width="${w * 0.8}" height="${h * 0.16}" rx="14" fill="hsl(${hue + 10},25%,60%)"/>
    <circle cx="${w * 0.78}" cy="${h * 0.48}" r="${w * 0.1}" fill="hsl(120,25%,45%)" opacity=".7"/>
    <rect x="${w * 0.76}" y="${h * 0.5}" width="4" height="${h * 0.12}" fill="hsl(30,30%,35%)"/>
  </g>`;
}

function veilTile(x, y, w, h, t, kind, top = false) {
  const title = kind === "ad" ? t.ad : t.ai;
  const cy = top ? 78 : h / 2;
  return `
  <g transform="translate(${x},${y})">
    <rect width="${w}" height="${h}" rx="18" fill="#ece4d8"/>
    <rect width="${w}" height="${h}" rx="18" fill="#f5f0e8" opacity=".75"/>
    <text x="${w / 2}" y="${cy - 18}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="700" fill="${C.ink}">${esc(title)}</text>
    ${kind === "ai" ? `<text x="${w / 2}" y="${cy + 4}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${C.muted}">${esc(t.why)}</text>` : ""}
    <rect x="${w / 2 - 44}" y="${cy + 18}" width="88" height="28" rx="14" fill="#fff" stroke="${C.line}"/>
    <text x="${w / 2}" y="${cy + 37}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="600" fill="${C.ink}">${esc(t.show)}</text>
  </g>`;
}

function debugBox(x, y, w, lines) {
  const h = 18 + lines.length * 19;
  return `
  <g transform="translate(${x},${y})">
    <rect width="${w}" height="${h}" rx="12" fill="#14100c" opacity=".9"/>
    ${lines
      .map(
        ([text, color], i) =>
          `<text x="12" y="${24 + i * 19}" font-family="${MONO}" font-size="13" font-weight="${i === 0 ? 700 : 500}" fill="${color ?? "#f5efe6"}">${esc(text)}</text>`,
      )
      .join("")}
  </g>`;
}

function heading(lines, sub, x = 72, y = lines.length > 2 ? 230 : 250) {
  return `
  ${lines.map((l, i) => `<text x="${x}" y="${y + i * 62}" font-family="${FONT}" font-size="54" font-weight="800" fill="${C.ink}" letter-spacing="-1">${esc(l)}</text>`).join("")}
  ${sub.map((l, i) => `<text x="${x}" y="${y + lines.length * 62 + 34 + i * 32}" font-family="${FONT}" font-size="22" fill="${C.muted}">${esc(l)}</text>`).join("")}`;
}

function brand(x = 72, y = 120) {
  return `
  <g transform="translate(${x},${y - 34})">
    <rect width="44" height="44" rx="11" fill="${C.accent}"/>
    <g stroke="#f5efe6" stroke-width="4" stroke-linecap="round"><path d="M10 15h24M10 22h24M10 29h24"/></g>
    <g stroke="#d9b48f" stroke-width="4" stroke-linecap="round"><path d="M15 10v24M22 10v24M29 10v24"/></g>
    <text x="58" y="31" font-family="${FONT}" font-size="26" font-weight="800" fill="${C.ink}">Tissé</text>
  </g>`;
}

const frame = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800"><rect width="1280" height="800" fill="${C.bg}"/>${body}</svg>`;

// ---------- Captures ----------

function shot1(t) {
  const col = (x, items) => {
    let y = 70;
    return items
      .map(([h, kind, hue], i) => {
        const s = kind === "photo" ? photoTile(x, y, 200, h, hue, `${x}${i}`) : veilTile(x, y, 200, h, t, kind);
        y += h + 18;
        return s;
      })
      .join("");
  };
  return frame(`
    ${brand()}${heading(t.s1, t.s1sub)}
    ${col(620, [[300, "photo", 30], [260, "ai"], [240, "photo", 18]])}
    ${col(838, [[220, "ad"], [320, "photo", 40], [260, "ai"]])}
    ${col(1056, [[280, "photo", 22], [240, "ai"], [300, "photo", 35]])}`);
}

function shot2(t) {
  return frame(`
    ${brand()}${heading(t.s2, t.s2sub)}
    ${veilTile(640, 90, 280, 420, t, "ai", true)}
    ${debugBox(652, 330, 256, t.debug)}
    ${photoTile(950, 140, 280, 420, 28, "d2")}
    ${debugBox(962, 420, 256, t.debug2)}`);
}

function shot3(t) {
  const px = 720;
  const py = 70;
  const check = (x, y, on) =>
    `<rect x="${x}" y="${y - 15}" width="18" height="18" rx="4" fill="${on ? C.accent : "#fff"}" stroke="${on ? C.accent : C.line}"/>${on ? `<path d="M${x + 4} ${y - 6}l4 4 7-8" stroke="#fff" stroke-width="2.4" fill="none"/>` : ""}`;
  const radio = (x, y, on) => `<circle cx="${x + 9}" cy="${y - 6}" r="9" fill="#fff" stroke="${on ? C.accent : C.line}" stroke-width="2"/>${on ? `<circle cx="${x + 9}" cy="${y - 6}" r="4.5" fill="${C.accent}"/>` : ""}`;
  return frame(`
    ${brand()}${heading(t.s3, t.s3sub)}
    <g>
      <rect x="${px}" y="${py}" width="460" height="660" rx="22" fill="${C.card}" stroke="${C.line}"/>
      <rect x="${px + 28}" y="${py + 28}" width="30" height="30" rx="8" fill="${C.accent}"/>
      <g stroke="#f5efe6" stroke-width="2.6" stroke-linecap="round"><path d="M${px + 35} ${py + 38}h16M${px + 35} ${py + 43}h16M${px + 35} ${py + 48}h16"/></g>
      <g stroke="#d9b48f" stroke-width="2.6" stroke-linecap="round"><path d="M${px + 38} ${py + 35}v16M${px + 43} ${py + 35}v16M${px + 48} ${py + 35}v16"/></g>
      <text x="${px + 72}" y="${py + 50}" font-family="${FONT}" font-size="19" font-weight="700" fill="${C.ink}">${esc(t.popupTitle)}</text>
      <rect x="${px + 384}" y="${py + 30}" width="48" height="26" rx="13" fill="${C.accent}"/><circle cx="${px + 419}" cy="${py + 43}" r="9" fill="#fff"/>
      ${[0, 1]
        .map(
          (i) => `
        <rect x="${px + 28 + i * 208}" y="${py + 84}" width="196" height="92" rx="14" fill="${C.bg}" stroke="${C.line}"/>
        <text x="${px + 46 + i * 208}" y="${py + 128}" font-family="${FONT}" font-size="34" font-weight="800" fill="${C.accent}">${i === 0 ? 12 : 37}</text>
        <text x="${px + 46 + i * 208}" y="${py + 156}" font-family="${FONT}" font-size="15" fill="${C.muted}">${esc(t.stats[i])}</text>`,
        )
        .join("")}
      ${t.options
        .map(
          (o, i) => `${check(px + 28, py + 230 + i * 40, true)}<text x="${px + 58}" y="${py + 230 + i * 40}" font-family="${FONT}" font-size="17" fill="${C.ink}">${esc(o)}</text>`,
        )
        .join("")}
      <rect x="${px + 28}" y="${py + 396}" width="404" height="104" rx="14" fill="none" stroke="${C.line}"/>
      ${t.modes
        .map((m, i) => `${radio(px + 46, py + 436 + i * 40, i === 1)}<text x="${px + 76}" y="${py + 436 + i * 40}" font-family="${FONT}" font-size="17" fill="${C.ink}">${esc(m)}</text>`)
        .join("")}
      ${photoTile(px + 28, py + 528, 196, 104, 25, "p1")}
      <rect x="${px + 40}" y="${py + 566}" width="54" height="28" rx="14" fill="${C.ink}"/>
      <text x="${px + 67}" y="${py + 585}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700" fill="#fff">${esc(t.report)}</text>
      ${veilTile(px + 236, py + 528, 196, 104, { ...t, why: "" }, "ad")}
    </g>`);
}

function promo(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
    <rect width="440" height="280" fill="${C.accent}"/>
    <g transform="translate(36,40)">
      <rect width="64" height="64" rx="16" fill="#f5efe6"/>
      <g stroke="${C.accent}" stroke-width="6" stroke-linecap="round"><path d="M14 22h36M14 32h36M14 42h36"/></g>
      <g stroke="#d9b48f" stroke-width="6" stroke-linecap="round"><path d="M22 14v36M32 14v36M42 14v36"/></g>
    </g>
    <text x="118" y="86" font-family="${FONT}" font-size="34" font-weight="800" fill="#fff">Tissé</text>
    ${t.promo.map((l, i) => `<text x="36" y="${168 + i * 40}" font-family="${FONT}" font-size="31" font-weight="800" fill="#fff">${esc(l)}</text>`).join("")}
  </svg>`;
}

// ---------- Rendu ----------

const render = (svg, file) => sharp(Buffer.from(svg)).png().toFile(file);

for (const lang of ["fr", "en"]) {
  const dir = `${out}/screenshots/${lang}`;
  await mkdir(dir, { recursive: true });
  const t = T[lang];
  await render(shot1(t), `${dir}/1-masquage.png`);
  await render(shot2(t), `${dir}/2-debug.png`);
  await render(shot3(t), `${dir}/3-reglages.png`);
  await render(promo(t), `${out}/promo-440x280-${lang}.png`);
}
// Icône de la fiche : 128×128, logo de 96×96 centré, 16 px de marge transparente (consignes du Chrome Web Store).
const logo = await sharp(`${root}static/icon.svg`, { density: 300 }).resize(96, 96).png().toBuffer();
await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: logo, left: 16, top: 16 }])
  .png()
  .toFile(`${out}/icon-128.png`);

console.log(`Visuels générés dans ${out}`);
