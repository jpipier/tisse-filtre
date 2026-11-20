// Règles de décision : pub ou non, IA probable ou non, avec la raison. Pures et déterministes.
import type { PinInfo } from "./pins";

export type AiReason = "pinterest-label" | "keywords" | "generator-size" | "ai-domain" | "known-ai" | "detector";

export interface Verdict {
  ad: boolean;
  /** Raisons de penser que l'image est générée par IA ; vide = rien à signaler. */
  ai: AiReason[];
}

export interface ClassifyOptions {
  /** Signatures confirmées IA (signalements, détecteur externe). */
  knownAiSignatures?: ReadonlySet<string>;
  /** Signatures que l'utilisateur a déclarées « vraie photo » : jamais masquées comme IA. */
  allowedSignatures?: ReadonlySet<string>;
  /** Indice des dimensions de générateur (activé par défaut). */
  sizeHeuristic?: boolean;
}

/**
 * Tailles de sortie natives des générateurs courants (largeur ≤ hauteur ; l'orientation inverse est aussi testée).
 * OpenAI (DALL·E 3, gpt-image), SDXL et Flux (seaux d'entraînement), Midjourney, Imagen et Gemini.
 */
export const NATIVE_SIZES: ReadonlyArray<readonly [number, number, string]> = [
  [1024, 1024, "OpenAI, SDXL, Flux, Imagen (carré)"],
  [1024, 1536, "OpenAI (gpt-image)"],
  [1024, 1792, "OpenAI (DALL·E 3)"],
  [896, 1152, "SDXL / Flux / Gemini"],
  [832, 1216, "SDXL / Flux"],
  [768, 1344, "SDXL / Flux / Gemini"],
  [640, 1536, "SDXL"],
  [896, 1344, "Midjourney"],
  [928, 1232, "Midjourney"],
  [816, 1456, "Midjourney"],
  [832, 1248, "Gemini"],
  [864, 1184, "Gemini"],
  [896, 1280, "Imagen"],
  [768, 1408, "Imagen"],
];

export const UPSCALE_FACTORS = [1.5, 2, 3, 4];
const TOLERANCE = 1;

const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;

export function matchesSize(width: number, height: number, w: number, h: number): boolean {
  return (near(width, w) && near(height, h)) || (near(width, h) && near(height, w));
}

/** « native » si les dimensions sont celles d'un générateur, « upscaled » si c'en est un agrandissement exact. */
export function matchGeneratorSize(width: number | null, height: number | null): "native" | "upscaled" | null {
  if (!width || !height) return null;
  if (NATIVE_SIZES.some(([w, h]) => matchesSize(width, height, w, h))) return "native";
  const upscaled = NATIVE_SIZES.some(([w, h]) => UPSCALE_FACTORS.some((f) => matchesSize(width, height, w * f, h * f)));
  return upscaled ? "upscaled" : null;
}

/** Un générateur produit du PNG ou du WebP ; un JPEG a été réexporté, donc seules les tailles très typées comptent. */
export function generatorSizeSignal(pin: PinInfo): boolean {
  const match = matchGeneratorSize(pin.origWidth, pin.origHeight);
  if (!match) return false;
  const lossless = pin.origExt === "png" || pin.origExt === "webp";
  if (lossless) return true;
  const square = pin.origWidth === pin.origHeight;
  return match === "native" && !square;
}

export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[​-‍⁠﻿­]/g, "") // caractères invisibles (Pinterest écrit « Sponsorisé​ »)
    .replace(/[  ]/g, " ")
    .replace(/[’`]/g, "'");

/** Expressions repérées dans le texte de l'épingle (après passage en minuscules et retrait des accents). */
export const AI_PATTERNS: readonly RegExp[] = [
  /\bmid-?journey\b/,
  /\bstable ?diffusion\b/,
  /\bsdxl\b/,
  /\bdall[-·. ]?e\b/,
  /\bchat ?gpt\b/,
  /\bgpt[- ]?(4o|image)\b/,
  /\bleonardo[ .]?ai\b/,
  /\bnano[- ]?banana\b/,
  /\bflux(\.1| ?(dev|pro|schnell|kontext))\b/,
  /\badobe firefly\b/,
  /\b(ideogram|nightcafe|comfyui|automatic1111)\b/,
  /\b(krea|playground|openart|seaart|tensor)[ .]?ai\b/,
  /\bai ?art(work)?s?\b/,
  /\bai[- ](generated|created|made|image|images|photo|render|rendering|artist|interior|design|fashion|model)\b/,
  /\b(generated|created|made|rendered) (with|by|using) (an? )?ai\b/,
  /\bgenere[es]{0,2} (par|avec) (l')?(ia|ai|intelligence artificielle)\b/,
  /\b(cree|creee|realise|realisee|fait|faite)s? (par|avec) (l')?(ia|intelligence artificielle)\b/,
  /\b(image|photo|visuel|rendu|illustration|creation|art)s? (ia|ai)\b/,
  /(^|\s)#(ai|ia|aiart|artia|iaart|aiartwork|aiartcommunity|aigenerated|aigeneratedart|aiimage|aiinteriordesign|aidesign|aifashion|generativeai|genai|midjourney\w*|stablediffusion\w*|dalle\w*|imagenia)\b/,
];

export function hasAiKeywords(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return AI_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Sites qui publient uniquement des images générées. */
const AI_DOMAINS = [
  "midjourney.com",
  "lexica.art",
  "civitai.com",
  "openart.ai",
  "playgroundai.com",
  "playground.com",
  "nightcafe.studio",
  "leonardo.ai",
  "krea.ai",
  "ideogram.ai",
  "tensor.art",
  "seaart.ai",
  "pixai.art",
  "stablediffusionweb.com",
  "starryai.com",
  "dreamstudio.ai",
];

function isAiDomain(domain: string | null, link: string | null): boolean {
  const hosts: string[] = [];
  if (domain) hosts.push(domain.toLowerCase());
  if (link) {
    try {
      hosts.push(new URL(link).hostname.toLowerCase());
    } catch {
      // lien inexploitable : ignoré
    }
  }
  return hosts.some((host) => AI_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)));
}

/** Décide, pour une épingle, si c'est une pub et pourquoi elle serait générée par IA. */
export function classifyPin(pin: PinInfo, options: ClassifyOptions = {}): Verdict {
  const ad = pin.promoted;
  if (pin.signature && options.allowedSignatures?.has(pin.signature)) return { ad, ai: [] };

  const ai: AiReason[] = [];
  if (pin.aiLabel) ai.push("pinterest-label");
  if (hasAiKeywords(pin.text)) ai.push("keywords");
  if (options.sizeHeuristic !== false && generatorSizeSignal(pin)) ai.push("generator-size");
  if (isAiDomain(pin.domain, pin.link)) ai.push("ai-domain");
  if (pin.signature && options.knownAiSignatures?.has(pin.signature)) ai.push("known-ai");
  return { ad, ai };
}

/** Le libellé seul (« Sponsorisé ») ou suivi de l'annonceur (« Promu par Marque »), jamais un titre qui commence pareil. */
const SPONSORED_LABEL =
  /^(?:(?:sponsorise(?:e|s|es)?|sponsored|promoted|gesponsert|patrocinado|sponsorizzato|gesponsord|annonce|publicite|anzeige|ad)[.\s·]*$|(?:promue? par|promoted by|sponsorisee? par|sponsored by|gesponsert von|patrocinado por)(?:\s|$))/;

/** Texte court affiché par Pinterest sous une épingle sponsorisée (« Sponsorisé », « Promu par … »). */
export function isSponsoredLabel(text: string): boolean {
  const normalized = normalize(text).trim();
  if (normalized.length === 0 || normalized.length > 60) return false;
  return SPONSORED_LABEL.test(normalized);
}

const AI_LABEL_TEXT =
  /^(?:(?:modifiee?|generee?|creee?) (?:par|avec) (?:l')?ia|ai[- ](?:modified|generated)|(?:modified|generated|made) (?:with|by) ai|ki[- ](?:generiert|bearbeitet|modifiziert)|(?:modificad[oa]|generad[oa]) (?:con|por) (?:la )?ia|(?:modificat[oa]|generat[oa]) (?:con|dall'?) ?(?:l')?ia)[.\s]*$/;

/** Label court affiché par Pinterest sur une image modifiée ou générée par IA (« Modifié par IA », « AI modified »). */
export function isAiLabelText(text: string): boolean {
  const normalized = normalize(text).trim();
  if (normalized.length === 0 || normalized.length > 40) return false;
  return AI_LABEL_TEXT.test(normalized);
}
