import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, detectorReady, normalizeSettings, pageConfigFromSettings, parsePageConfig } from "../settings";

describe("normalizeSettings", () => {
  it("renvoie les valeurs par défaut pour un stockage vide ou corrompu", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("garde les valeurs valides et remplace les autres", () => {
    const s = normalizeSettings({ hideAds: false, mode: "nimporte", detector: { apiUser: " u ", dailyLimit: -3 } });
    expect(s.hideAds).toBe(false);
    expect(s.mode).toBe("veil");
    expect(s.detector.apiUser).toBe("u");
    expect(s.detector.dailyLimit).toBe(DEFAULT_SETTINGS.detector.dailyLimit);
  });

  it("active par défaut le filtre « Moins d'IA » de Pinterest", () => {
    expect(normalizeSettings({}).pinterestFilter).toBe(true);
    expect(normalizeSettings({ pinterestFilter: false }).pinterestFilter).toBe(false);
  });

  it("le détecteur n'est prêt qu'activé et avec ses deux identifiants", () => {
    expect(detectorReady(normalizeSettings({ detector: { enabled: true, apiUser: "u" } }))).toBe(false);
    expect(detectorReady(normalizeSettings({ detector: { enabled: true, apiUser: "u", apiSecret: "s" } }))).toBe(true);
  });
});

describe("mode d'affichage", () => {
  it("accepte « remove » et convertit l'ancien « hide » (emplacement vide) en « remove »", () => {
    expect(normalizeSettings({ mode: "remove" }).mode).toBe("remove");
    expect(normalizeSettings({ mode: "hide" }).mode).toBe("remove");
    expect(normalizeSettings({ mode: "autre" }).mode).toBe("veil");
  });
});

describe("pageConfig", () => {
  it("dérive la configuration du script de page à partir des réglages", () => {
    const s = normalizeSettings({ mode: "remove", hideAds: true, hideAi: false });
    expect(pageConfigFromSettings(s)).toEqual({
      filterGenAi: false,
      removal: { removeAds: true, removeAi: false, sizeHeuristic: true },
    });
    expect(pageConfigFromSettings(normalizeSettings({})).removal).toBeNull();
    expect(pageConfigFromSettings(normalizeSettings({ enabled: false, mode: "remove" }))).toEqual({ filterGenAi: false, removal: null });
  });

  it("relit une configuration stockée, en revenant aux valeurs sûres si elle est illisible", () => {
    const s = normalizeSettings({ mode: "remove" });
    expect(parsePageConfig(JSON.stringify(pageConfigFromSettings(s)))).toEqual(pageConfigFromSettings(s));
    expect(parsePageConfig(null)).toEqual({ filterGenAi: true, removal: null });
    expect(parsePageConfig("{pas du json")).toEqual({ filterGenAi: true, removal: null });
    expect(parsePageConfig(JSON.stringify({ filterGenAi: "oui", removal: { removeAds: 1 } }))).toEqual({ filterGenAi: true, removal: null });
  });
});

describe("mode debug", () => {
  it("est désactivé par défaut", () => {
    expect(normalizeSettings({}).debug).toBe(false);
    expect(normalizeSettings({ debug: true }).debug).toBe(true);
  });

  it("suspend le retrait des réponses, pour garder les épingles visibles avec leur explication", () => {
    expect(pageConfigFromSettings(normalizeSettings({ mode: "remove", debug: true })).removal).toBeNull();
  });
});
