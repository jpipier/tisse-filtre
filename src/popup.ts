// Fenêtre de l'extension : réglages et compteurs de l'onglet courant.
import { ALLOWED_KEY, KNOWN_AI_KEY, SETTINGS_KEY, normalizeSettings, type Settings } from "./core/settings";
import type { RuntimeMessage, TabStats } from "./messages";

const SIGHTENGINE_ORIGIN = "https://api.sightengine.com/*";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const checkbox = (id: string) => $<HTMLInputElement>(id);

let settings: Settings;

async function save(next: Settings): Promise<void> {
  settings = next;
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
}

function render(): void {
  checkbox("enabled").checked = settings.enabled;
  checkbox("hideAds").checked = settings.hideAds;
  checkbox("hideAi").checked = settings.hideAi;
  checkbox("sizeHeuristic").checked = settings.sizeHeuristic;
  checkbox("sizeHeuristic").disabled = !settings.hideAi;
  checkbox("pinterestFilter").checked = settings.pinterestFilter;
  checkbox("debug").checked = settings.debug;
  checkbox("pinterestFilter").disabled = !settings.hideAi;
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) radio.checked = radio.value === settings.mode;
  checkbox("detectorEnabled").checked = settings.detector.enabled;
  $<HTMLInputElement>("apiUser").value = settings.detector.apiUser;
  $<HTMLInputElement>("apiSecret").value = settings.detector.apiSecret;
  $<HTMLInputElement>("dailyLimit").value = String(settings.detector.dailyLimit);
  document.body.style.opacity = "1";
}

async function renderLists(): Promise<void> {
  const stored = await chrome.storage.local.get([KNOWN_AI_KEY, ALLOWED_KEY]);
  const known = Array.isArray(stored[KNOWN_AI_KEY]) ? stored[KNOWN_AI_KEY].length : 0;
  const allowed = Array.isArray(stored[ALLOWED_KEY]) ? stored[ALLOWED_KEY].length : 0;
  $("lists").textContent = `${known} signalée${known > 1 ? "s" : ""} IA · ${allowed} vraie${allowed > 1 ? "s" : ""} photo${allowed > 1 ? "s" : ""}`;
}

async function renderStats(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;
  const message: RuntimeMessage = { type: "get-stats", tabId: tab.id };
  const stats = await chrome.runtime.sendMessage<TabStats>(message).catch(() => ({ ads: 0, ai: 0 }));
  $("stat-ads").textContent = String(stats?.ads ?? 0);
  $("stat-ai").textContent = String(stats?.ai ?? 0);
}

async function renderDetectorStatus(): Promise<void> {
  const status = $("detector-status");
  if (!settings.detector.enabled) {
    status.textContent = "";
    return;
  }
  const granted = await chrome.permissions.contains({ origins: [SIGHTENGINE_ORIGIN] });
  if (!granted) status.textContent = "Autorisation d'accès à Sightengine refusée : le détecteur reste inactif.";
  else if (!settings.detector.apiUser || !settings.detector.apiSecret) status.textContent = "Saisissez vos identifiants Sightengine.";
  else status.textContent = "Détecteur actif.";
}

function bind(): void {
  const toggle = (id: string, apply: (s: Settings, value: boolean) => Settings) =>
    checkbox(id).addEventListener("change", async (event) => {
      await save(apply(settings, (event.target as HTMLInputElement).checked));
      render();
    });

  toggle("enabled", (s, v) => ({ ...s, enabled: v }));
  toggle("hideAds", (s, v) => ({ ...s, hideAds: v }));
  toggle("hideAi", (s, v) => ({ ...s, hideAi: v }));
  toggle("sizeHeuristic", (s, v) => ({ ...s, sizeHeuristic: v }));
  toggle("pinterestFilter", (s, v) => ({ ...s, pinterestFilter: v }));
  toggle("debug", (s, v) => ({ ...s, debug: v }));

  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
    radio.addEventListener("change", () => void save({ ...settings, mode: radio.value === "remove" ? "remove" : "veil" }));
  }

  checkbox("detectorEnabled").addEventListener("change", async (event) => {
    const enabled = (event.target as HTMLInputElement).checked;
    // La permission doit être demandée pendant le clic de l'utilisateur.
    const granted = enabled ? await chrome.permissions.request({ origins: [SIGHTENGINE_ORIGIN] }) : true;
    await save({ ...settings, detector: { ...settings.detector, enabled: enabled && granted } });
    render();
    await renderDetectorStatus();
  });

  const text = (id: "apiUser" | "apiSecret") =>
    $<HTMLInputElement>(id).addEventListener("change", async (event) => {
      await save(normalizeSettings({ ...settings, detector: { ...settings.detector, [id]: (event.target as HTMLInputElement).value } }));
      await renderDetectorStatus();
    });
  text("apiUser");
  text("apiSecret");

  $<HTMLInputElement>("dailyLimit").addEventListener("change", async (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    await save(normalizeSettings({ ...settings, detector: { ...settings.detector, dailyLimit: value } }));
    render();
  });

  $("reset-lists").addEventListener("click", async () => {
    if (!confirm("Effacer vos signalements « IA » et vos « vraies photos » ?")) return;
    await chrome.storage.local.remove([KNOWN_AI_KEY, ALLOWED_KEY, "detectedHuman"]);
    await renderLists();
  });
}

async function main(): Promise<void> {
  settings = normalizeSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);
  render();
  bind();
  await Promise.all([renderLists(), renderStats(), renderDetectorStatus()]);
}

void main();
