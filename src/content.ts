// Script de contenu : rapproche les épingles affichées des données reçues par la page,
// décide (pub / IA probable) et pose un voile, ou masque, selon les réglages.
import { classifyPin, isAiLabelText, isSponsoredLabel, type AiReason } from "./core/classify";
import { explainPin } from "./core/explain";
import { compactColumns, parseTranslate, rememberHidden, type Tile } from "./core/masonry";
import { mergePins, signatureFromImageUrl, type PinInfo } from "./core/pins";
import {
  ALLOWED_KEY,
  KNOWN_AI_KEY,
  PAGE_CONFIG_KEY,
  SETTINGS_KEY,
  detectorReady,
  normalizeSettings,
  pageConfigFromSettings,
  type Settings,
} from "./core/settings";
import { MESSAGE_SOURCE, type DetectResponse, type RuntimeMessage } from "./messages";

const UNIT_SELECTOR = '[data-grid-item], [data-test-id="pin"], [data-test-id="pinWrapper"]';
const CLOSEUP_SELECTOR = '[data-test-id="closeup-image"], [data-test-id="pin-closeup-image"], [data-test-id="closeup-body-image-container"]';
const OWN = "tisse-own";

const REASON_LABELS: Record<AiReason, string> = {
  "pinterest-label": "label Pinterest",
  keywords: "mots-clés IA",
  "generator-size": "dimensions de générateur",
  "ai-domain": "site d'images IA",
  "known-ai": "signalée",
  detector: "détecteur",
};

let settings: Settings = normalizeSettings(undefined);
let knownAi = new Set<string>();
let allowed = new Set<string>();
const byId = new Map<string, PinInfo>();
const bySignature = new Map<string, PinInfo>();
const detectionRequested = new Set<string>();
/** Unités que l'utilisateur a choisi d'afficher malgré tout (clé = signature ou id). */
const revealed = new Set<string>();
let hiddenAds = new Set<string>();
let hiddenAi = new Set<string>();
let currentPath = location.pathname;

// ---------- Données venant de la page ----------

function remember(pin: PinInfo): void {
  const previous = byId.get(pin.id);
  const merged = previous ? mergePins(previous, pin) : pin;
  byId.set(merged.id, merged);
  if (merged.signature) bySignature.set(merged.signature, merged);
}

function isPinInfo(value: unknown): value is PinInfo {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.text === "string" && typeof v.promoted === "boolean" && typeof v.aiLabel === "boolean";
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== MESSAGE_SOURCE) return;
  if (event.data.kind === "pins") {
    const pins: unknown = event.data.pins;
    if (!Array.isArray(pins)) return;
    for (const pin of pins) if (isPinInfo(pin)) remember(pin);
    schedule();
  }
  if (event.data.kind === "removed") {
    // Épingles retirées des réponses par le script de page : jamais affichées, mais comptées.
    const removed: unknown = event.data.removed;
    if (!Array.isArray(removed)) return;
    for (const item of removed as Array<{ key?: unknown; reason?: unknown }>) {
      if (typeof item?.key !== "string") continue;
      if (item.reason === "ad") hiddenAds.add(item.key);
      else if (item.reason === "ai") hiddenAi.add(item.key);
    }
    sendStats();
  }
});

// ---------- Lecture du DOM ----------

function imageUrls(img: HTMLImageElement): string[] {
  const urls = [img.currentSrc, img.src];
  for (const part of (img.srcset || "").split(",")) {
    const url = part.trim().split(/\s+/)[0];
    if (url) urls.push(url);
  }
  return urls.filter(Boolean);
}

function readImage(unit: Element): { signature: string | null; origExt: string | null; imageUrl: string | null } {
  for (const img of unit.querySelectorAll("img")) {
    const urls = imageUrls(img);
    for (const url of urls) {
      const signature = signatureFromImageUrl(url);
      if (!signature) continue;
      const original = urls.find((u) => u.includes("/originals/"));
      const origExt = original ? (/\.([a-z0-9]+)$/i.exec(original)?.[1]?.toLowerCase() ?? null) : null;
      return { signature, origExt, imageUrl: original ?? url };
    }
  }
  return { signature: null, origExt: null, imageUrl: null };
}

function readPinId(unit: Element): string | null {
  const link = unit.querySelector<HTMLAnchorElement>('a[href*="/pin/"]');
  return link ? (/\/pin\/([\w-]+)/.exec(link.getAttribute("href") ?? "")?.[1] ?? null) : null;
}

/** Signaux visibles dans le DOM : mention « Sponsorisé », label « Modifié par IA », attributs de pub. */
function readDomSignals(unit: Element): { sponsored: boolean; aiLabel: boolean } {
  let sponsored = unit.querySelector('[data-test-id*="promoted" i], [data-test-id*="sponsor" i], [data-test-id="ad-badge"]') !== null;
  let aiLabel = unit.querySelector('[data-test-id*="ai-label" i], [data-test-id*="gen-ai" i], [data-test-id*="genai" i]') !== null;
  if (sponsored && aiLabel) return { sponsored, aiLabel };
  for (const el of unit.querySelectorAll<HTMLElement>("span, div, a, p, h2, h3")) {
    if (el.childElementCount > 0 || el.closest(`.${OWN}`)) continue;
    const text = el.textContent ?? "";
    if (text.length === 0 || text.length > 60) continue;
    if (!sponsored && isSponsoredLabel(text)) sponsored = true;
    if (!aiLabel && isAiLabelText(text)) aiLabel = true;
    if (sponsored && aiLabel) break;
  }
  return { sponsored, aiLabel };
}

interface Unit {
  element: HTMLElement;
  key: string;
  info: PinInfo;
  imageUrl: string | null;
  /** Vrai si l'épingle a été trouvée dans les données de Pinterest (texte, dimensions…), faux si seulement dans la page. */
  fromData: boolean;
}

function collectUnits(): Unit[] {
  const units: Unit[] = [];
  const elements = new Set<HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>(UNIT_SELECTOR)) {
    if (el.parentElement?.closest(UNIT_SELECTOR)) continue; // seulement l'élément le plus externe
    elements.add(el);
  }
  for (const el of document.querySelectorAll<HTMLElement>(CLOSEUP_SELECTOR)) {
    if (!el.closest(UNIT_SELECTOR) && !el.parentElement?.closest(CLOSEUP_SELECTOR)) elements.add(el);
  }

  for (const element of elements) {
    const { signature, origExt, imageUrl } = readImage(element);
    const id = readPinId(element) ?? (element.matches(CLOSEUP_SELECTOR) ? (/\/pin\/([\w-]+)/.exec(location.pathname)?.[1] ?? null) : null);
    if (!signature && !id) continue;
    const known = (id ? byId.get(id) : undefined) ?? (signature ? bySignature.get(signature) : undefined);
    const dom = readDomSignals(element);
    const base: PinInfo = known ?? {
      id: id ?? signature ?? "",
      signature,
      text: "",
      domain: null,
      link: null,
      origWidth: null,
      origHeight: null,
      origExt,
      promoted: false,
      aiLabel: false,
    };
    const info: PinInfo = {
      ...base,
      signature: base.signature ?? signature,
      origExt: base.origExt ?? origExt,
      promoted: base.promoted || dom.sponsored,
      aiLabel: base.aiLabel || dom.aiLabel,
    };
    units.push({ element, key: info.signature ?? info.id, info, imageUrl, fromData: known !== undefined });
  }
  return units;
}

// ---------- Affichage ----------

function ensurePositioned(element: HTMLElement): void {
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
}

function stop(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.className = "tisse-btn";
  b.addEventListener("click", (e) => {
    stop(e);
    onClick();
  });
  return b;
}

/** Événements qui, en remontant jusqu'à Pinterest, ouvriraient l'épingle sous le voile ou le bouton. */
const BLOCKED_EVENTS = ["click", "auxclick", "pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"];

/**
 * Empêche ces événements de remonter jusqu'à Pinterest. Écoute en phase de bouillonnement (pas de capture) :
 * les boutons à l'intérieur reçoivent donc le clic d'abord.
 */
function isolate(element: HTMLElement): void {
  for (const type of BLOCKED_EVENTS) {
    element.addEventListener(type, (event) => {
      event.stopPropagation();
      if (type === "click" || type === "auxclick") event.preventDefault();
    });
  }
}

async function addToList(storageKey: string, signature: string): Promise<void> {
  const stored = await chrome.storage.local.get(storageKey);
  const list = Array.isArray(stored[storageKey]) ? (stored[storageKey] as string[]) : [];
  if (!list.includes(signature)) await chrome.storage.local.set({ [storageKey]: [...list, signature].slice(-20_000) });
}

async function removeFromList(storageKey: string, signature: string): Promise<void> {
  const stored = await chrome.storage.local.get(storageKey);
  const list = Array.isArray(stored[storageKey]) ? (stored[storageKey] as string[]) : [];
  await chrome.storage.local.set({ [storageKey]: list.filter((s) => s !== signature) });
}

function veil(unit: Unit, kind: "ad" | "ai", reasons: AiReason[]): void {
  const { element, key, info } = unit;
  const state = `${kind}:${reasons.join(",")}:${displayMode()}`;
  const existing = element.querySelector<HTMLElement>(":scope > .tisse-veil");
  if (existing && element.dataset.tisseState === state) return;
  existing?.remove();

  element.dataset.tisse = kind;
  element.dataset.tisseState = state;
  // Mesure avant de masquer : une fois en display:none, la hauteur n'est plus lisible.
  const height = parseFloat(element.style.height) || element.offsetHeight;
  if (height > 0) element.dataset.tisseH = String(height);
  element.dataset.tisseMode = displayMode();
  ensurePositioned(element);

  const overlay = document.createElement("div");
  overlay.className = `tisse-veil ${OWN}`;
  isolate(overlay);

  const title = document.createElement("strong");
  title.textContent = kind === "ad" ? "Publicité masquée" : "Image IA probable";
  overlay.append(title);

  if (kind === "ai") {
    const why = document.createElement("span");
    why.className = "tisse-why";
    why.textContent = reasons.map((r) => REASON_LABELS[r]).join(" · ");
    overlay.append(why);
  }

  const actions = document.createElement("div");
  actions.className = "tisse-actions";
  actions.append(
    button("Afficher", () => {
      revealed.add(key);
      clear(element);
    }),
  );
  if (kind === "ai" && info.signature) {
    const signature = info.signature;
    actions.append(
      button("C'est une vraie photo", () => {
        revealed.add(key);
        clear(element);
        void removeFromList(KNOWN_AI_KEY, signature);
        void addToList(ALLOWED_KEY, signature);
      }),
    );
  }
  overlay.append(actions);
  element.append(overlay);
}

function reportButton(unit: Unit): void {
  const { element, info } = unit;
  if (!info.signature || element.querySelector(":scope > .tisse-report")) return;
  const signature = info.signature;
  ensurePositioned(element);
  const b = button("IA ?", () => {
    b.textContent = "Signalée ✓";
    b.classList.add("tisse-report-done");
    revealed.delete(unit.key);
    void addToList(KNOWN_AI_KEY, signature).then(() => removeFromList(ALLOWED_KEY, signature));
  });
  isolate(b);
  b.classList.add("tisse-report", OWN);
  b.title = "Signaler cette image comme générée par IA (elle sera masquée partout)";
  element.append(b);
}

function clear(element: HTMLElement): void {
  element.querySelector(":scope > .tisse-veil")?.remove();
  delete element.dataset.tisse;
  delete element.dataset.tisseState;
  delete element.dataset.tisseMode;
}

function clearAll(): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-tisse]")) clear(el);
  for (const el of document.querySelectorAll(".tisse-report, .tisse-debug")) el.remove();
}

/** En mode debug, les épingles restent visibles (voile) pour qu'on puisse lire leur explication. */
function displayMode(): Settings["mode"] {
  return settings.debug ? "veil" : settings.mode;
}

// ---------- Mode debug ----------

function debugPanel(unit: Unit): void {
  const { element, info } = unit;
  const explanation = explainPin(info, { knownAiSignatures: knownAi, allowedSignatures: allowed, sizeHeuristic: settings.sizeHeuristic });
  const header = { ad: "PUB", ai: "IA", none: "RIEN À MASQUER" }[explanation.decision];
  const lines = [
    ...explanation.lines,
    unit.fromData ? "Données : réponse de Pinterest" : "Données : page seulement (ni texte ni dimensions reçus)",
    revealed.has(unit.key) ? "Affichée à ta demande" : "",
  ].filter(Boolean);
  const content = [header, ...lines].join("\n");

  let panel = element.querySelector<HTMLElement>(":scope > .tisse-debug");
  if (panel?.dataset.content === content) return;
  if (!panel) {
    panel = document.createElement("div");
    panel.className = `tisse-debug ${OWN}`;
    ensurePositioned(element);
    element.append(panel);
  }
  panel.dataset.content = content;
  panel.dataset.decision = explanation.decision;
  panel.replaceChildren(
    Object.assign(document.createElement("strong"), { textContent: header }),
    ...lines.map((line) => Object.assign(document.createElement("div"), { textContent: line })),
  );
}

// ---------- Boucle principale ----------

function requestDetection(unit: Unit): void {
  const signature = unit.info.signature;
  if (!signature || !unit.imageUrl || detectionRequested.has(signature)) return;
  detectionRequested.add(signature);
  const message: RuntimeMessage = { type: "detect", signature, imageUrl: unit.imageUrl };
  chrome.runtime
    .sendMessage<DetectResponse>(message)
    .then((response) => {
      // Un verdict « ai » est aussi écrit dans knownAi par le service worker : la mise à jour du stockage relance le tri.
      if (response?.verdict === "unknown") detectionRequested.delete(signature);
    })
    .catch(() => detectionRequested.delete(signature));
}

function scan(): void {
  if (location.pathname !== currentPath) {
    currentPath = location.pathname;
    hiddenAds = new Set();
    hiddenAi = new Set();
  }
  if (!settings.enabled) {
    clearAll();
    sendStats();
    return;
  }

  const units = collectUnits();
  for (const unit of units) {
    unit.element.dataset.tisseKey = unit.key;
    const verdict = classifyPin(unit.info, { knownAiSignatures: knownAi, allowedSignatures: allowed, sizeHeuristic: settings.sizeHeuristic });
    const hideAd = settings.hideAds && verdict.ad;
    const hideAi = settings.hideAi && verdict.ai.length > 0;

    if (hideAd) hiddenAds.add(unit.key);
    else if (hideAi) hiddenAi.add(unit.key);

    if (revealed.has(unit.key) || (!hideAd && !hideAi)) {
      clear(unit.element);
      if (settings.hideAi && !verdict.ad) {
        reportButton(unit);
        if (!revealed.has(unit.key) && detectorReady(settings)) requestDetection(unit);
      }
      continue;
    }
    unit.element.querySelector(":scope > .tisse-report")?.remove();
    veil(unit, hideAd ? "ad" : "ai", hideAd ? [] : verdict.ai);
  }
  for (const unit of units) {
    if (settings.debug) debugPanel(unit);
    else unit.element.querySelector(":scope > .tisse-debug")?.remove();
  }
  compactMasonry();
  sendStats();
}

// ---------- Tassement de la mosaïque ----------
// Pinterest positionne chaque épingle en absolu : une épingle en display:none laisse un trou.
// On remonte les épingles situées dessous, dans la même colonne. Les positions d'origine (celles de Pinterest)
// sont mémorisées sur l'élément ; si Pinterest réécrit la position, c'est la nouvelle origine.

const GRID_ITEM = "[data-grid-item]";
/** Par conteneur : largeur (une autre largeur = autre disposition) et épingles masquées, même démontées. */
const masonryState = new WeakMap<HTMLElement, { width: number; hidden: Map<string, Tile> }>();

function originOf(item: HTMLElement): { x: number; y: number } | null {
  const current = item.style.transform;
  const { tisseSet, tisseX, tisseY } = item.dataset;
  if (tisseSet !== undefined && current === tisseSet && tisseX !== undefined && tisseY !== undefined) {
    return { x: Number(tisseX), y: Number(tisseY) };
  }
  const position = parseTranslate(current);
  if (!position) return null;
  item.dataset.tisseX = String(position.x);
  item.dataset.tisseY = String(position.y);
  delete item.dataset.tisseSet;
  return position;
}

function heightOf(item: HTMLElement): number {
  const measured = parseFloat(item.style.height) || item.offsetHeight;
  if (measured > 0) item.dataset.tisseH = String(measured);
  return measured || Number(item.dataset.tisseH ?? 0);
}

function placeAt(item: HTMLElement, x: number, y: number): void {
  item.style.transform = `translateX(${x}px) translateY(${y}px)`;
  item.dataset.tisseSet = item.style.transform;
}

function compactMasonry(): void {
  const containers = new Set<HTMLElement>();
  for (const item of document.querySelectorAll<HTMLElement>(GRID_ITEM)) if (item.parentElement) containers.add(item.parentElement);

  for (const container of containers) {
    let state = masonryState.get(container);
    if (!state || state.width !== container.clientWidth) {
      state = { width: container.clientWidth, hidden: new Map() };
      masonryState.set(container, state);
    }

    const mounted: Array<{ item: HTMLElement; tile: Tile }> = [];
    for (const item of container.querySelectorAll<HTMLElement>(`:scope > ${GRID_ITEM}`)) {
      const origin = originOf(item);
      if (!origin) continue;
      const hidden = item.dataset.tisseMode === "remove";
      const key = item.dataset.tisseKey ?? `${origin.x}:${origin.y}`;
      const tile: Tile = { key, x: origin.x, y: origin.y, height: heightOf(item), hidden };
      if (hidden) state.hidden.set(key, rememberHidden(state.hidden.get(key), tile));
      else state.hidden.delete(key);
      mounted.push({ item, tile });
    }

    const visible = mounted.filter((m) => !m.tile.hidden);
    const moves = state.hidden.size > 0 ? compactColumns([...state.hidden.values(), ...visible.map((m) => m.tile)]) : new Map<string, number>();
    for (const { item, tile } of visible) {
      const y = moves.get(tile.key);
      if (y !== undefined) {
        if (item.style.transform !== `translateX(${tile.x}px) translateY(${y}px)`) placeAt(item, tile.x, y);
      } else if (item.dataset.tisseSet !== undefined) {
        // plus rien à tasser au-dessus : retour à la position de Pinterest
        item.style.transform = `translateX(${tile.x}px) translateY(${tile.y}px)`;
        delete item.dataset.tisseSet;
      }
    }
  }
}

/** Réagit aux ajouts d'éléments, et aux repositionnements des épingles par Pinterest (pas aux nôtres). */
function onMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    if (mutation.type === "childList") return schedule();
    const target = mutation.target as HTMLElement;
    if (target.matches?.(GRID_ITEM) && target.style.transform !== target.dataset.tisseSet) return schedule();
  }
}

let lastStats = "";
function sendStats(): void {
  const stats = { ads: hiddenAds.size, ai: hiddenAi.size };
  const serialized = JSON.stringify(stats);
  if (serialized === lastStats) return;
  lastStats = serialized;
  const message: RuntimeMessage = { type: "stats", stats };
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

let scheduled = false;
let lastRun = 0;
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  const delay = Math.max(0, 150 - (Date.now() - lastRun));
  setTimeout(() => {
    requestAnimationFrame(() => {
      scheduled = false;
      lastRun = Date.now();
      try {
        scan();
      } catch (error) {
        console.warn("[Tissé] analyse interrompue", error);
      }
    });
  }, delay);
}

async function loadState(): Promise<void> {
  const stored = await chrome.storage.local.get([SETTINGS_KEY, KNOWN_AI_KEY, ALLOWED_KEY]);
  settings = normalizeSettings(stored[SETTINGS_KEY]);
  knownAi = new Set(Array.isArray(stored[KNOWN_AI_KEY]) ? (stored[KNOWN_AI_KEY] as string[]) : []);
  allowed = new Set(Array.isArray(stored[ALLOWED_KEY]) ? (stored[ALLOWED_KEY] as string[]) : []);

  // Le script de page lit cette configuration dès son démarrage au prochain chargement, avant les premières requêtes.
  const config = pageConfigFromSettings(settings);
  try {
    window.localStorage.setItem(PAGE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // stockage indisponible : le message ci-dessous suffit pour la suite de la session
  }
  window.postMessage(
    { source: MESSAGE_SOURCE, kind: "config", config, lists: { knownAi: [...knownAi], allowed: [...allowed] } },
    window.location.origin,
  );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (SETTINGS_KEY in changes || KNOWN_AI_KEY in changes || ALLOWED_KEY in changes) {
    void loadState().then(() => {
      for (const el of document.querySelectorAll<HTMLElement>("[data-tisse]")) delete el.dataset.tisseState;
      schedule();
    });
  }
});

void loadState().then(() => {
  new MutationObserver(onMutations).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
  });
  window.postMessage({ source: MESSAGE_SOURCE, kind: "rescan" }, window.location.origin);
  schedule();
});
