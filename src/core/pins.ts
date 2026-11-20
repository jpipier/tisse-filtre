// Extraction des épingles depuis les données JSON que le site de Pinterest charge lui-même
// (réponses /resource/…, données initiales __PWS_DATA__). Pure : aucun accès au DOM ni au réseau.

/** Ce que l'extension retient d'une épingle pour décider de la masquer. */
export interface PinInfo {
  id: string;
  /** Empreinte de fichier Pinterest (32 hex), présente aussi dans l'URL de l'image : clé de rapprochement avec le DOM. */
  signature: string | null;
  /** Titre, description, textes alternatifs… concaténés. */
  text: string;
  domain: string | null;
  link: string | null;
  origWidth: number | null;
  origHeight: number | null;
  /** Extension du fichier original (« png », « jpg », « webp »…). */
  origExt: string | null;
  promoted: boolean;
  /** Label IA posé par Pinterest lui-même. */
  aiLabel: boolean;
}

const SIGNATURE_IN_URL = /^\/[^/]+\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/([0-9a-f]{32})\.[a-z0-9]+$/i;

/** Signature d'une image i.pinimg.com (« /236x/7f/6b/17/<signature>.jpg »), ou null. */
export function signatureFromImageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "i.pinimg.com") return null;
  const match = SIGNATURE_IN_URL.exec(parsed.pathname);
  return match ? match[1].toLowerCase() : null;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;
const asString = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const TEXT_FIELDS = ["title", "grid_title", "description", "closeup_unified_description", "auto_alt_text", "seo_alt_text", "alt_text", "seo_title", "rich_summary"] as const;

/** Champs dont la présence (non vide) indique une épingle sponsorisée. */
const AD_FIELDS = ["is_promoted", "promoter", "campaign_id", "ad_match_reason", "is_downstream_promotion", "promoted_is_removable"] as const;

/**
 * Nom de champ évoquant un label IA : « is_ai_generated », « gen_ai_label », « ai_modified_label »…
 * Exclut les fonctionnalités (« is_eligible_for_ai_tools ») qui n'en disent rien sur l'image.
 */
function isAiLabelKey(key: string): boolean {
  const k = key.toLowerCase();
  const mentionsAi = /(^|_)(gen_?ai|ai)(_|$)/.test(k) || k.includes("genai");
  if (!mentionsAi) return false;
  if (/eligib|tool|enabled|allow|feature|assist|edit_|cutout|search/.test(k)) return false;
  return /generat|modif|label|genai|gen_ai|disclos|^is_ai/.test(k);
}

/** Valeur qui affirme réellement le label (pas false, pas null, pas « NONE »). */
function isAffirmative(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim() !== "" && !/^(none|false|0|not_.*|no|unknown|unlabeled)$/i.test(value.trim());
  if (Array.isArray(value)) return value.some(isAffirmative);
  if (isObject(value)) return Object.values(value).some((v) => typeof v !== "object" && isAffirmative(v));
  return false;
}

/** Cherche un label IA dans les champs de l'épingle et de ses sous-objets directs (pas dans les épingles imbriquées). */
function hasAiLabel(pin: Json): boolean {
  for (const [key, value] of Object.entries(pin)) {
    if (isAiLabelKey(key) && isAffirmative(value)) return true;
  }
  for (const value of Object.values(pin)) {
    if (!isObject(value) || Array.isArray(value) || value.type === "pin") continue;
    for (const [key, nested] of Object.entries(value)) {
      if (isAiLabelKey(key) && isAffirmative(nested)) return true;
    }
  }
  return false;
}

function isPromoted(pin: Json): boolean {
  return AD_FIELDS.some((field) => {
    const value = pin[field];
    if (value === true) return true;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.trim() !== "" && value !== "0";
    return isObject(value);
  });
}

function readPin(pin: Json, id: string): PinInfo {
  const images = isObject(pin.images) ? pin.images : {};
  const orig = isObject(images.orig) ? images.orig : null;
  const anyImageUrl =
    asString(orig?.url) ??
    Object.values(images)
      .map((img) => (isObject(img) ? asString(img.url) : null))
      .find((url): url is string => url !== null) ??
    null;
  const origUrl = asString(orig?.url);
  const ext = origUrl ? /\.([a-z0-9]+)(?:$|\?)/i.exec(new URL(origUrl, "https://i.pinimg.com").pathname)?.[1] ?? null : null;
  const signature = asString(pin.image_signature)?.toLowerCase() ?? (anyImageUrl ? signatureFromImageUrl(anyImageUrl) : null);

  const texts = TEXT_FIELDS.map((field) => {
    const value = pin[field];
    if (isObject(value)) return asString(value.display_name) ?? asString(value.text) ?? asString(value.title);
    return asString(value);
  }).filter((t): t is string => t !== null);

  return {
    id,
    signature,
    text: [...new Set(texts)].join("\n"),
    domain: asString(pin.domain),
    link: asString(pin.link),
    origWidth: asNumber(orig?.width),
    origHeight: asNumber(orig?.height),
    origExt: ext ? ext.toLowerCase().replace("jpeg", "jpg") : null,
    promoted: isPromoted(pin),
    aiLabel: hasAiLabel(pin),
  };
}

/** Fusionne deux vues d'une même épingle : chaque information connue l'emporte sur une absence. */
export function mergePins(a: PinInfo, b: PinInfo): PinInfo {
  const texts = new Set([...a.text.split("\n"), ...b.text.split("\n")].filter(Boolean));
  return {
    id: a.id,
    signature: a.signature ?? b.signature,
    text: [...texts].join("\n"),
    domain: a.domain ?? b.domain,
    link: a.link ?? b.link,
    origWidth: a.origWidth ?? b.origWidth,
    origHeight: a.origHeight ?? b.origHeight,
    origExt: a.origExt ?? b.origExt,
    promoted: a.promoted || b.promoted,
    aiLabel: a.aiLabel || b.aiLabel,
  };
}

/** Parcourt une valeur JSON quelconque et renvoie les épingles trouvées, dédoublonnées par identifiant. */
export function extractPins(root: unknown): PinInfo[] {
  const found = new Map<string, PinInfo>();
  const seen = new WeakSet<object>();
  const stack: unknown[] = [root];

  while (stack.length > 0) {
    const value = stack.pop();
    if (!isObject(value) || seen.has(value)) continue;
    seen.add(value);

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) stack.push(value[i]);
      continue;
    }

    const id = value.type === "pin" ? asString(value.id) ?? (typeof value.id === "number" ? String(value.id) : null) : null;
    if (id) {
      const info = readPin(value, id);
      const previous = found.get(id);
      found.set(id, previous ? mergePins(previous, info) : info);
    }
    for (const child of Object.values(value)) if (isObject(child)) stack.push(child);
  }
  return [...found.values()];
}

/** Lit une seule valeur JSON : ses informations si c'est une épingle, null sinon. */
export function readPinInfo(value: unknown): PinInfo | null {
  if (!isObject(value) || Array.isArray(value) || value.type !== "pin") return null;
  const id = asString(value.id) ?? (typeof value.id === "number" ? String(value.id) : null);
  return id ? readPin(value, id) : null;
}
