// S'exécute dans la page de Pinterest (monde « MAIN »), avant ses propres scripts.
// - Lit les données JSON que le site reçoit déjà et transmet les épingles au script de contenu.
// - Active le filtre « Moins d'IA » de Pinterest sur ses requêtes.
// - En mode « retirer », enlève pubs et images IA des réponses avant que Pinterest ne les affiche.
import { extractPins, type PinInfo } from "./core/pins";
import { forceGenAiFilter, forceGenAiFilterInBody } from "./core/request-filter";
import { removePins, type RemovalConfig, type Removed } from "./core/response-filter";
import { PAGE_CONFIG_KEY, parsePageConfig, type PageConfig } from "./core/settings";
import { MESSAGE_SOURCE } from "./messages";

const INTERESTING = /\/resource\/|\/_\/graphql\//;

// ---------- Configuration ----------

/** Lue dans le localStorage dès le démarrage (le script de contenu l'y écrit), puis mise à jour par message. */
let config: PageConfig = (() => {
  try {
    return parsePageConfig(window.localStorage.getItem(PAGE_CONFIG_KEY));
  } catch {
    return parsePageConfig(null);
  }
})();
let knownAi = new Set<string>();
let allowed = new Set<string>();

function removalConfig(): RemovalConfig | null {
  return config.removal ? { ...config.removal, knownAi, allowed } : null;
}

// ---------- Vers le script de contenu ----------

function post(message: Record<string, unknown>): void {
  window.postMessage({ source: MESSAGE_SOURCE, ...message }, window.location.origin);
}

function publish(pins: PinInfo[]): void {
  if (pins.length > 0) post({ kind: "pins", pins });
}

function publishRemoved(removed: Removed[]): void {
  if (removed.length === 0) return;
  post({ kind: "removed", removed: removed.map(({ pin, reason }) => ({ key: pin.signature ?? pin.id, reason })) });
}

function inspect(json: unknown): void {
  try {
    publish(extractPins(json));
  } catch {
    // une réponse inattendue ne doit jamais casser la page
  }
}

function parseJson(text: string): unknown {
  if (!text || (text[0] !== "{" && text[0] !== "[")) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function inspectText(text: string): void {
  const json = parseJson(text);
  if (json !== undefined) inspect(json);
}

/** Inspecte la réponse puis renvoie, si besoin, sa version sans pubs ni images IA (null : à garder telle quelle). */
function filterJson(json: unknown): unknown | null {
  inspect(json);
  const removal = removalConfig();
  if (!removal) return null;
  try {
    const { value, removed } = removePins(json, removal);
    publishRemoved(removed);
    return removed.length > 0 ? value : null;
  } catch {
    return null;
  }
}

// ---------- Requêtes sortantes : filtre « Moins d'IA » ----------

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function withGenAiFilter(args: Parameters<typeof fetch>): Parameters<typeof fetch> {
  if (!config.filterGenAi) return args;
  try {
    const [input, init] = args;
    const nextInit = init && typeof init.body === "string" ? { ...init, body: forceGenAiFilterInBody(init.body) } : init;
    if (typeof input === "string") return [forceGenAiFilter(input), nextInit];
    if (input instanceof URL) return [forceGenAiFilter(input.href), nextInit];
    const rewritten = forceGenAiFilter(input.url);
    return [rewritten === input.url ? input : new Request(rewritten, input), nextInit];
  } catch {
    return args;
  }
}

// ---------- fetch ----------

const originalFetch = window.fetch;
window.fetch = async function patchedFetch(this: typeof window, ...original: Parameters<typeof fetch>) {
  const args = withGenAiFilter(original);
  const response = await originalFetch.apply(this, args);
  try {
    if (!INTERESTING.test(urlOf(args[0])) || !(response.headers.get("content-type") ?? "").includes("json")) return response;
    if (!removalConfig()) {
      response
        .clone()
        .text()
        .then(inspectText, () => undefined);
      return response;
    }
    const text = await response.clone().text();
    const json = parseJson(text);
    const filtered = json === undefined ? null : filterJson(json);
    if (filtered === null) return response;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(JSON.stringify(filtered), { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
};

// ---------- XMLHttpRequest ----------
// Pinterest charge ses épingles par XHR. La réponse filtrée est servie par des accesseurs posés sur l'instance,
// calculée une seule fois quand la requête est terminée, quel que soit l'ordre des écouteurs de Pinterest.

const proto = XMLHttpRequest.prototype;
const responseTextGetter = Object.getOwnPropertyDescriptor(proto, "responseText")?.get;
const responseGetter = Object.getOwnPropertyDescriptor(proto, "response")?.get;

function installFilteredResponse(xhr: XMLHttpRequest): void {
  if (!responseTextGetter || !responseGetter) return;
  let computed = false;
  let filteredText: string | null = null;
  let filteredJson: unknown = null;

  const compute = () => {
    if (computed || xhr.readyState !== XMLHttpRequest.DONE) return;
    computed = true;
    try {
      if (xhr.responseType === "json") {
        const filtered = filterJson(responseGetter.call(xhr));
        if (filtered !== null) filteredJson = filtered;
      } else if (xhr.responseType === "" || xhr.responseType === "text") {
        const json = parseJson(responseTextGetter.call(xhr) as string);
        const filtered = json === undefined ? null : filterJson(json);
        if (filtered !== null) filteredText = JSON.stringify(filtered);
      }
    } catch {
      // en cas de doute, la réponse d'origine
    }
  };

  Object.defineProperty(xhr, "responseText", {
    configurable: true,
    get() {
      compute();
      return filteredText ?? responseTextGetter.call(xhr);
    },
  });
  Object.defineProperty(xhr, "response", {
    configurable: true,
    get() {
      compute();
      if (xhr.responseType === "json") return filteredJson ?? responseGetter.call(xhr);
      if ((xhr.responseType === "" || xhr.responseType === "text") && filteredText !== null) return filteredText;
      return responseGetter.call(xhr);
    },
  });
  // Calcule (et transmet les épingles au script de contenu) même si Pinterest ne lit pas la réponse.
  xhr.addEventListener("readystatechange", compute);
}

const originalOpen = proto.open;
proto.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]) {
  if (config.filterGenAi && typeof args[1] === "string") args[1] = forceGenAiFilter(args[1]);
  else if (config.filterGenAi && args[1] instanceof URL) args[1] = forceGenAiFilter(args[1].href);
  if (INTERESTING.test(String(args[1] ?? ""))) installFilteredResponse(this);
  return (originalOpen as (...a: unknown[]) => void).apply(this, args);
} as typeof proto.open;

const originalSend = proto.send;
proto.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
  const next = config.filterGenAi && typeof body === "string" ? forceGenAiFilterInBody(body) : body;
  return originalSend.call(this, next);
};

// ---------- Données embarquées dans le HTML au premier chargement ----------
// Déjà rendues côté serveur : on ne peut que les lire ; le script de contenu masque ces épingles dans le DOM.

function readEmbedded(): void {
  for (const id of ["__PWS_DATA__", "__PWS_INITIAL_PROPS__", "__PWS_RELAY_REGISTER_COMPLETED_REQUEST__"]) {
    const node = document.getElementById(id);
    if (node?.textContent) inspectText(node.textContent);
  }
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]:not([id])')) {
    if (script.textContent && script.textContent.length < 5_000_000) inspectText(script.textContent);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", readEmbedded, { once: true });
else readEmbedded();

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== MESSAGE_SOURCE) return;
  if (event.data.kind === "rescan") readEmbedded();
  if (event.data.kind === "config") {
    config = parsePageConfig(JSON.stringify(event.data.config));
    const lists = event.data.lists as { knownAi?: unknown; allowed?: unknown } | undefined;
    if (Array.isArray(lists?.knownAi)) knownAi = new Set(lists.knownAi.filter((s): s is string => typeof s === "string"));
    if (Array.isArray(lists?.allowed)) allowed = new Set(lists.allowed.filter((s): s is string => typeof s === "string"));
  }
});
