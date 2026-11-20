// Active le filtre « Moins d'IA » de Pinterest (option filter_genai des requêtes /resource/…),
// comme si l'utilisateur avait cliqué sur la pastille. Pur : ne fait que réécrire une chaîne.

const BASE = "https://pinterest.invalid";

/** Passe options.filter_genai à true dans le paramètre « data » ; null si rien à changer. */
function rewriteData(data: string | null): string | null {
  if (!data) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const options = (parsed as { options?: unknown }).options;
  if (typeof options !== "object" || options === null || !("filter_genai" in options)) return null;
  if ((options as { filter_genai?: unknown }).filter_genai === true) return null;
  return JSON.stringify({ ...parsed, options: { ...options, filter_genai: true } });
}

/** URL d'une requête GET de Pinterest, avec le filtre IA activé si elle le prévoit ; inchangée sinon. */
export function forceGenAiFilter(url: string): string {
  if (!url.includes("/resource/") || !url.includes("filter_genai")) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, BASE);
  } catch {
    return url;
  }
  const data = rewriteData(parsed.searchParams.get("data"));
  if (!data) return url;
  parsed.searchParams.set("data", data);
  return parsed.origin === BASE ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
}

/** Corps « application/x-www-form-urlencoded » d'une requête POST, avec le filtre IA activé si prévu. */
export function forceGenAiFilterInBody(body: string): string {
  if (!body.includes("filter_genai")) return body;
  const params = new URLSearchParams(body);
  const data = rewriteData(params.get("data"));
  if (!data) return body;
  params.set("data", data);
  return params.toString();
}
