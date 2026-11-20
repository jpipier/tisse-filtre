// Messages échangés entre la page, le script de contenu, le service worker et la fenêtre de l'extension.

/** Marque les messages window.postMessage de l'extension. */
export const MESSAGE_SOURCE = "tisse-filtre";

export interface TabStats {
  ads: number;
  ai: number;
}

export type RuntimeMessage =
  | { type: "stats"; stats: TabStats }
  | { type: "get-stats"; tabId: number }
  | { type: "detect"; signature: string; imageUrl: string };

export type DetectResponse = { verdict: "ai" | "human" | "unknown" };
