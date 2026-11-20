// Réglages de l'extension, stockés dans chrome.storage.local sous la clé SETTINGS_KEY.

export interface Settings {
  enabled: boolean;
  hideAds: boolean;
  hideAi: boolean;
  /** « veil » : image floutée avec bouton « afficher » ; « remove » : épingle retirée de la mosaïque, sans trou. */
  mode: "veil" | "remove";
  /** Active le filtre « Moins d'IA » de Pinterest sur ses propres requêtes (recherche notamment). */
  pinterestFilter: boolean;
  /** Indice « dimensions d'un générateur » : le plus efficace, mais le seul qui peut se tromper sur une vraie photo. */
  sizeHeuristic: boolean;
  /** Affiche sur chaque épingle les indices examinés et la décision ; suspend le retrait complet. */
  debug: boolean;
  /** Détecteur Sightengine (clé de l'utilisateur), pour les images que les autres indices n'ont pas tranchées. */
  detector: { enabled: boolean; apiUser: string; apiSecret: string; dailyLimit: number };
}

export const SETTINGS_KEY = "settings";
/** Signatures confirmées IA (signalement manuel ou détecteur). */
export const KNOWN_AI_KEY = "knownAi";
/** Signatures déclarées « vraie photo » par l'utilisateur. */
export const ALLOWED_KEY = "allowed";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  hideAds: true,
  hideAi: true,
  mode: "veil",
  pinterestFilter: true,
  sizeHeuristic: true,
  debug: false,
  detector: { enabled: false, apiUser: "", apiSecret: "", dailyLimit: 300 },
};

/** Complète des réglages lus du stockage (anciens, partiels ou corrompus) avec les valeurs par défaut. */
export function normalizeSettings(raw: unknown): Settings {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const d = typeof r.detector === "object" && r.detector !== null ? (r.detector as Record<string, unknown>) : {};
  const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return {
    enabled: bool(r.enabled, DEFAULT_SETTINGS.enabled),
    hideAds: bool(r.hideAds, DEFAULT_SETTINGS.hideAds),
    hideAi: bool(r.hideAi, DEFAULT_SETTINGS.hideAi),
    // « hide » (emplacement vide, ancien réglage) devient « remove ».
    mode: r.mode === "remove" || r.mode === "hide" ? "remove" : "veil",
    pinterestFilter: bool(r.pinterestFilter, DEFAULT_SETTINGS.pinterestFilter),
    sizeHeuristic: bool(r.sizeHeuristic, DEFAULT_SETTINGS.sizeHeuristic),
    debug: bool(r.debug, DEFAULT_SETTINGS.debug),
    detector: {
      enabled: bool(d.enabled, false),
      apiUser: str(d.apiUser),
      apiSecret: str(d.apiSecret),
      dailyLimit:
        typeof d.dailyLimit === "number" && Number.isInteger(d.dailyLimit) && d.dailyLimit >= 0
          ? Math.min(d.dailyLimit, 10_000)
          : DEFAULT_SETTINGS.detector.dailyLimit,
    },
  };
}

/** Le détecteur est utilisable : activé et identifiants saisis. */
export function detectorReady(settings: Settings): boolean {
  return settings.detector.enabled && settings.detector.apiUser !== "" && settings.detector.apiSecret !== "";
}

/** Clé, dans le localStorage de Pinterest, de la configuration lue par le script de page dès son démarrage. */
export const PAGE_CONFIG_KEY = "tisse-filtre:config";

/** Ce que le script de page (monde MAIN, sans accès à chrome.storage) doit savoir pour réécrire requêtes et réponses. */
export interface PageConfig {
  filterGenAi: boolean;
  /** null : ne rien retirer des réponses (mode voile ou extension en pause). */
  removal: { removeAds: boolean; removeAi: boolean; sizeHeuristic: boolean } | null;
}

export function pageConfigFromSettings(settings: Settings): PageConfig {
  return {
    filterGenAi: settings.enabled && settings.hideAi && settings.pinterestFilter,
    removal:
      settings.enabled && settings.mode === "remove" && !settings.debug
        ? { removeAds: settings.hideAds, removeAi: settings.hideAi, sizeHeuristic: settings.sizeHeuristic }
        : null,
  };
}

/** Relit la configuration stockée ; en cas de doute, filtre IA de Pinterest actif et rien de retiré. */
export function parsePageConfig(raw: string | null): PageConfig {
  const fallback: PageConfig = { filterGenAi: true, removal: null };
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== "object" || parsed === null) return fallback;
  const p = parsed as { filterGenAi?: unknown; removal?: unknown };
  const r = typeof p.removal === "object" && p.removal !== null ? (p.removal as Record<string, unknown>) : null;
  const removal =
    r && typeof r.removeAds === "boolean" && typeof r.removeAi === "boolean" && typeof r.sizeHeuristic === "boolean"
      ? { removeAds: r.removeAds, removeAi: r.removeAi, sizeHeuristic: r.sizeHeuristic }
      : null;
  return { filterGenAi: typeof p.filterGenAi === "boolean" ? p.filterGenAi : true, removal };
}
