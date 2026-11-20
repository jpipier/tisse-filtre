// Mode debug : explique, indice par indice, pourquoi une épingle est (ou n'est pas) classée pub ou IA.
// S'appuie sur classifyPin pour que l'explication corresponde toujours à la décision réelle.
import { AI_PATTERNS, NATIVE_SIZES, UPSCALE_FACTORS, classifyPin, matchesSize, normalize, type ClassifyOptions } from "./classify";
import type { PinInfo } from "./pins";

export interface Explanation {
  decision: "ad" | "ai" | "none";
  lines: string[];
}

/** Passage du texte d'origine (accents et casse conservés) qui a déclenché un motif IA, ou null. */
export function findAiKeyword(text: string): string | null {
  if (!text) return null;
  // Normalise caractère par caractère pour retrouver la position dans le texte d'origine.
  let normalized = "";
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const part = normalize(char);
    for (let i = 0; i < part.length; i++) origin.push(index);
    normalized += part;
    index += char.length;
  }
  for (const pattern of AI_PATTERNS) {
    const match = pattern.exec(normalized);
    if (!match || match[0].length === 0) continue;
    let start = origin[match.index];
    if (start > 0 && text[start - 1] === "#") start--; // hashtag : on garde le dièse
    const lastOrigin = origin[match.index + match[0].length - 1];
    const lastChar = String.fromCodePoint(text.codePointAt(lastOrigin) ?? 0);
    return text.slice(start, lastOrigin + lastChar.length).trim();
  }
  return null;
}

/** Générateurs dont la taille correspond (factor 1 = taille native), ou null. */
export function describeGeneratorSize(width: number | null, height: number | null): { factor: number; generators: string[] } | null {
  if (!width || !height) return null;
  for (const factor of [1, ...UPSCALE_FACTORS]) {
    const generators = NATIVE_SIZES.filter(([w, h]) => matchesSize(width, height, w * factor, h * factor)).map(([, , label]) => label);
    if (generators.length > 0) return { factor, generators };
  }
  return null;
}

const formatFactor = (factor: number) => String(factor).replace(".", ",");

function dimensionsLine(pin: PinInfo, retained: boolean, enabled: boolean): string {
  if (!pin.origWidth || !pin.origHeight) return "? Dimensions de l'original inconnues";
  const format = pin.origExt ? pin.origExt.toUpperCase() : "format inconnu";
  const base = `Dimensions : ${format} ${pin.origWidth}×${pin.origHeight}`;
  if (!enabled) return `– ${base}, indice désactivé dans les réglages`;
  const size = describeGeneratorSize(pin.origWidth, pin.origHeight);
  if (!size) return `✘ ${base}, taille ordinaire`;
  const who = size.generators.join(" / ");
  const what = size.factor === 1 ? `taille native de ${who}` : `taille de ${who} ×${formatFactor(size.factor)}`;
  return retained ? `✔ ${base}, ${what}` : `✘ ${base}, ${what}, non retenue (JPEG agrandi ou carré, trop courant hors IA)`;
}

export function explainPin(pin: PinInfo, options: ClassifyOptions = {}): Explanation {
  const verdict = classifyPin(pin, options);
  // Les indices sont évalués sans la liste blanche, pour montrer ce qu'elle neutralise.
  const raw = classifyPin(pin, { ...options, allowedSignatures: undefined });
  const lines: string[] = [];

  if (pin.promoted) lines.push("✔ Sponsorisée");
  const allowed = pin.signature !== null && options.allowedSignatures?.has(pin.signature) === true;
  if (allowed) lines.push("Marquée « vraie photo » : indices IA ignorés");

  lines.push(pin.aiLabel ? "✔ Label IA posé par Pinterest" : "✘ Pas de label IA Pinterest");
  const keyword = findAiKeyword(pin.text);
  lines.push(keyword ? `✔ Mot-clé IA : « ${keyword} »` : pin.text ? "✘ Aucun mot-clé IA dans le texte" : "? Aucun texte reçu");
  if (raw.ai.includes("ai-domain")) lines.push(`✔ Site d'images IA : ${pin.domain ?? pin.link}`);
  else if (pin.domain) lines.push(`✘ Site : ${pin.domain}`);
  lines.push(dimensionsLine(pin, raw.ai.includes("generator-size"), options.sizeHeuristic !== false));
  if (raw.ai.includes("known-ai")) lines.push("✔ Signalée comme IA (par toi ou par le détecteur)");

  const decision = verdict.ad ? "ad" : verdict.ai.length > 0 ? "ai" : "none";
  if (raw.ai.length === 0) lines.push("Aucun indice IA");
  return { decision, lines };
}
