// Retire les pubs et les images IA des données reçues par Pinterest, avant qu'il ne les affiche :
// la mosaïque se construit sans elles, donc sans trou. Pur : la réponse d'origine n'est jamais modifiée.
import { classifyPin } from "./classify";
import { readPinInfo, type PinInfo } from "./pins";

export interface RemovalConfig {
  removeAds: boolean;
  removeAi: boolean;
  sizeHeuristic: boolean;
  knownAi: ReadonlySet<string>;
  allowed: ReadonlySet<string>;
}

export type RemovalKind = "ad" | "ai";

export interface Removed {
  pin: PinInfo;
  reason: RemovalKind;
}

/** Pourquoi retirer cette épingle (« ad » l'emporte sur « ai »), ou null pour la garder. */
export function removalReason(pin: PinInfo, config: RemovalConfig): RemovalKind | null {
  const verdict = classifyPin(pin, {
    knownAiSignatures: config.knownAi,
    allowedSignatures: config.allowed,
    sizeHeuristic: config.sizeHeuristic,
  });
  if (config.removeAds && verdict.ad) return "ad";
  if (config.removeAi && verdict.ai.length > 0) return "ai";
  return null;
}

/**
 * Renvoie une copie de la valeur JSON sans les épingles à retirer, partout où elles sont des éléments de liste.
 * Les parties inchangées gardent leur référence ; sans rien à retirer, la valeur d'origine est renvoyée telle quelle.
 */
export function removePins(root: unknown, config: RemovalConfig): { value: unknown; removed: Removed[] } {
  const removed: Removed[] = [];
  const seen = new WeakSet<object>();

  function visit(value: unknown): unknown {
    if (typeof value !== "object" || value === null || seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
      let changed = false;
      const kept: unknown[] = [];
      for (const item of value) {
        const pin = readPinInfo(item);
        const reason = pin ? removalReason(pin, config) : null;
        if (pin && reason) {
          removed.push({ pin, reason });
          changed = true;
          continue;
        }
        const next = visit(item);
        if (next !== item) changed = true;
        kept.push(next);
      }
      return changed ? kept : value;
    }

    let copy: Record<string, unknown> | null = null;
    for (const [key, child] of Object.entries(value)) {
      const next = visit(child);
      if (next !== child) {
        copy ??= { ...(value as Record<string, unknown>) };
        copy[key] = next;
      }
    }
    return copy ?? value;
  }

  return { value: visit(root), removed };
}
