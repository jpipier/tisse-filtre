// Détecteur externe optionnel (Sightengine, modèle « genai ») : construit la requête et lit la réponse.
// L'appel réseau lui-même est fait par le service worker, avec la clé que l'utilisateur a saisie.
import { signatureFromImageUrl } from "./pins";

export interface DetectorCredentials {
  apiUser: string;
  apiSecret: string;
}

export type DetectorResult = { ok: true; score: number } | { ok: false; error: string };

/** Seuil au-delà duquel l'image est considérée comme générée par IA. */
export const DETECTOR_THRESHOLD = 0.85;

/** URL de l'API pour une image Pinterest ; on envoie la version 736x (suffisante et légère). */
export function buildDetectorUrl(imageUrl: string, credentials: DetectorCredentials): string {
  const signature = signatureFromImageUrl(imageUrl);
  if (!signature) throw new Error("image hors de i.pinimg.com");
  const image = `https://i.pinimg.com/736x/${signature.slice(0, 2)}/${signature.slice(2, 4)}/${signature.slice(4, 6)}/${signature}.jpg`;
  const url = new URL("https://api.sightengine.com/1.0/check.json");
  url.searchParams.set("url", image);
  url.searchParams.set("models", "genai");
  url.searchParams.set("api_user", credentials.apiUser);
  url.searchParams.set("api_secret", credentials.apiSecret);
  return url.toString();
}

export function parseDetectorResponse(body: unknown): DetectorResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "réponse inattendue" };
  const record = body as { status?: unknown; type?: { ai_generated?: unknown }; error?: { message?: unknown } };
  if (record.status === "success" && typeof record.type?.ai_generated === "number") {
    return { ok: true, score: record.type.ai_generated };
  }
  if (typeof record.error?.message === "string") return { ok: false, error: record.error.message };
  return { ok: false, error: "réponse inattendue" };
}
