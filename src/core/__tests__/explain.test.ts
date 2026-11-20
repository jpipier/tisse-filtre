import { describe, expect, it } from "vitest";
import { describeGeneratorSize, explainPin, findAiKeyword } from "../explain";
import type { PinInfo } from "../pins";

const pin = (overrides: Partial<PinInfo> = {}): PinInfo => ({
  id: "1",
  signature: "021d4d5654fac7b78aa99fac6db03a97",
  text: "",
  domain: null,
  link: null,
  origWidth: 3024,
  origHeight: 4032,
  origExt: "jpg",
  promoted: false,
  aiLabel: false,
  ...overrides,
});

describe("findAiKeyword", () => {
  it("renvoie le passage exact qui a déclenché la détection", () => {
    expect(findAiKeyword("Salon cosy, prompt Midjourney v7")).toBe("Midjourney");
    expect(findAiKeyword("Image générée par IA")).toBe("générée par IA");
    expect(findAiKeyword("#aiart #deco")).toBe("#aiart");
  });

  it("renvoie null sans mot-clé IA", () => {
    expect(findAiKeyword("Salon scandinave lumineux")).toBeNull();
    expect(findAiKeyword("")).toBeNull();
  });
});

describe("describeGeneratorSize", () => {
  it("nomme les générateurs correspondant à une taille native", () => {
    expect(describeGeneratorSize(1024, 1536)).toEqual({ factor: 1, generators: ["OpenAI (gpt-image)"] });
    expect(describeGeneratorSize(1216, 832)).toEqual({ factor: 1, generators: ["SDXL / Flux"] });
  });

  it("indique le facteur d'agrandissement", () => {
    expect(describeGeneratorSize(1536, 2304)).toEqual({ factor: 1.5, generators: ["OpenAI (gpt-image)"] });
  });

  it("renvoie null pour une taille ordinaire", () => {
    expect(describeGeneratorSize(3024, 4032)).toBeNull();
    expect(describeGeneratorSize(null, null)).toBeNull();
  });
});

describe("explainPin", () => {
  it("explique une image retenue pour ses dimensions", () => {
    const explanation = explainPin(pin({ origWidth: 1024, origHeight: 1536, origExt: "png" }));
    expect(explanation.decision).toBe("ai");
    expect(explanation.lines).toContain("✔ Dimensions : PNG 1024×1536, taille native de OpenAI (gpt-image)");
  });

  it("explique pourquoi des dimensions de générateur ne sont pas retenues sur un JPEG", () => {
    const explanation = explainPin(pin({ origWidth: 2048, origHeight: 3072, origExt: "jpg" }));
    expect(explanation.decision).toBe("none");
    expect(explanation.lines).toContain(
      "✘ Dimensions : JPG 2048×3072, taille de OpenAI (gpt-image) ×2, non retenue (JPEG agrandi ou carré, trop courant hors IA)",
    );
  });

  it("cite le mot-clé, le site, le label et le signalement", () => {
    const explanation = explainPin(pin({ text: "rendu Midjourney", domain: "lexica.art", aiLabel: true }), {
      knownAiSignatures: new Set(["021d4d5654fac7b78aa99fac6db03a97"]),
    });
    expect(explanation.lines).toEqual(
      expect.arrayContaining([
        "✔ Label IA posé par Pinterest",
        "✔ Mot-clé IA : « Midjourney »",
        "✔ Site d'images IA : lexica.art",
        "✔ Signalée comme IA (par toi ou par le détecteur)",
      ]),
    );
  });

  it("dit clairement quand rien n'a été trouvé, et quand les dimensions sont inconnues", () => {
    const explanation = explainPin(pin({ origWidth: null, origHeight: null, origExt: null }));
    expect(explanation.decision).toBe("none");
    expect(explanation.lines).toContain("? Dimensions de l'original inconnues");
    expect(explanation.lines).toContain("Aucun indice IA");
  });

  it("signale une pub, qui l'emporte sur les indices IA", () => {
    const explanation = explainPin(pin({ promoted: true, aiLabel: true }));
    expect(explanation.decision).toBe("ad");
    expect(explanation.lines[0]).toBe("✔ Sponsorisée");
  });

  it("signale la liste blanche, qui neutralise les indices IA", () => {
    const explanation = explainPin(pin({ aiLabel: true }), { allowedSignatures: new Set(["021d4d5654fac7b78aa99fac6db03a97"]) });
    expect(explanation.decision).toBe("none");
    expect(explanation.lines).toContain("Marquée « vraie photo » : indices IA ignorés");
  });

  it("indique que l'indice des dimensions est désactivé", () => {
    const explanation = explainPin(pin({ origWidth: 1024, origHeight: 1536, origExt: "png" }), { sizeHeuristic: false });
    expect(explanation.decision).toBe("none");
    expect(explanation.lines).toContain("– Dimensions : PNG 1024×1536, indice désactivé dans les réglages");
  });
});
