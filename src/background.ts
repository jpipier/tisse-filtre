// Service worker : compteur sur l'icône et appels au détecteur optionnel (avec cache et quota quotidien).
import { DETECTOR_THRESHOLD, buildDetectorUrl, parseDetectorResponse } from "./core/detector";
import { signatureFromImageUrl } from "./core/pins";
import { ALLOWED_KEY, KNOWN_AI_KEY, SETTINGS_KEY, detectorReady, normalizeSettings } from "./core/settings";
import type { DetectResponse, RuntimeMessage, TabStats } from "./messages";

const DETECTED_HUMAN_KEY = "detectedHuman";
const QUOTA_KEY = "detectorQuota";
const MAX_CONCURRENT = 3;

const statsByTab = new Map<number, TabStats>();

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

async function updateBadge(tabId: number, stats: TabStats): Promise<void> {
  const total = stats.ads + stats.ai;
  await chrome.action.setBadgeBackgroundColor({ color: "#7a4b2a", tabId });
  await chrome.action.setBadgeText({ text: total > 0 ? String(Math.min(total, 999)) : "", tabId });
}

// ---------- Détecteur ----------

let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function list(key: string): Promise<string[]> {
  const stored = await chrome.storage.local.get(key);
  return Array.isArray(stored[key]) ? (stored[key] as string[]) : [];
}

async function append(key: string, signature: string): Promise<void> {
  const current = await list(key);
  if (!current.includes(signature)) await chrome.storage.local.set({ [key]: [...current, signature].slice(-20_000) });
}

/** Réserve un appel dans le quota du jour ; false si le quota est atteint. */
async function takeQuota(dailyLimit: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const stored = (await chrome.storage.local.get(QUOTA_KEY))[QUOTA_KEY] as { day?: string; used?: number } | undefined;
  const used = stored?.day === today ? (stored.used ?? 0) : 0;
  if (used >= dailyLimit) return false;
  await chrome.storage.local.set({ [QUOTA_KEY]: { day: today, used: used + 1 } });
  return true;
}

async function detect(signature: string, imageUrl: string): Promise<DetectResponse> {
  if (signatureFromImageUrl(imageUrl) !== signature) return { verdict: "unknown" };
  const settings = normalizeSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);
  if (!detectorReady(settings)) return { verdict: "unknown" };

  const [known, human, allowed] = await Promise.all([list(KNOWN_AI_KEY), list(DETECTED_HUMAN_KEY), list(ALLOWED_KEY)]);
  if (known.includes(signature)) return { verdict: "ai" };
  if (human.includes(signature) || allowed.includes(signature)) return { verdict: "human" };

  return withSlot(async () => {
    if (!(await takeQuota(settings.detector.dailyLimit))) return { verdict: "unknown" };
    try {
      const response = await fetch(buildDetectorUrl(imageUrl, settings.detector));
      const result = parseDetectorResponse(await response.json());
      if (!result.ok) {
        console.warn("[Tissé] détecteur :", result.error);
        return { verdict: "unknown" };
      }
      if (result.score >= DETECTOR_THRESHOLD) {
        await append(KNOWN_AI_KEY, signature);
        return { verdict: "ai" };
      }
      await append(DETECTED_HUMAN_KEY, signature);
      return { verdict: "human" };
    } catch (error) {
      console.warn("[Tissé] détecteur injoignable", error);
      return { verdict: "unknown" };
    }
  });
}

// ---------- Messages ----------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return;
  if (message.type === "stats" && sender.tab?.id !== undefined) {
    statsByTab.set(sender.tab.id, message.stats);
    void updateBadge(sender.tab.id, message.stats);
    return;
  }
  if (message.type === "get-stats") {
    sendResponse(statsByTab.get(message.tabId) ?? { ads: 0, ai: 0 });
    return;
  }
  if (message.type === "detect") {
    void detect(message.signature, message.imageUrl).then(sendResponse);
    return true; // réponse asynchrone
  }
});

chrome.tabs.onRemoved.addListener((tabId) => statsByTab.delete(tabId));
