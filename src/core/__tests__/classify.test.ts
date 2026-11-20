import { describe, expect, it } from "vitest";
import { classifyPin, isAiLabelText, isSponsoredLabel, matchGeneratorSize } from "../classify";
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

describe("matchGeneratorSize", () => {
  it("reconnaît les tailles natives des générateurs, dans les deux orientations", () => {
    expect(matchGeneratorSize(1024, 1536)).toBe("native");
    expect(matchGeneratorSize(1536, 1024)).toBe("native");
    expect(matchGeneratorSize(832, 1216)).toBe("native"); // SDXL
    expect(matchGeneratorSize(1024, 1792)).toBe("native"); // DALL·E 3
    expect(matchGeneratorSize(1024, 1024)).toBe("native");
  });

  it("reconnaît une taille native agrandie ×1,5, ×2 ou ×4 (upscale)", () => {
    expect(matchGeneratorSize(1536, 2304)).toBe("upscaled");
    expect(matchGeneratorSize(2048, 3072)).toBe("upscaled");
    expect(matchGeneratorSize(1664, 2432)).toBe("upscaled");
  });

  it("tolère un pixel d'écart (arrondi d'export)", () => {
    expect(matchGeneratorSize(1023, 1537)).toBe("native");
  });

  it("ignore les tailles d'appareils photo et les dimensions inconnues", () => {
    expect(matchGeneratorSize(3024, 4032)).toBeNull();
    expect(matchGeneratorSize(1080, 1350)).toBeNull();
    expect(matchGeneratorSize(1000, 1500)).toBeNull();
    expect(matchGeneratorSize(null, null)).toBeNull();
  });
});

describe("classifyPin — publicités", () => {
  it("marque une épingle sponsorisée comme pub", () => {
    expect(classifyPin(pin({ promoted: true })).ad).toBe(true);
    expect(classifyPin(pin()).ad).toBe(false);
  });
});

describe("classifyPin — images IA", () => {
  it("fait confiance au label IA de Pinterest", () => {
    expect(classifyPin(pin({ aiLabel: true })).ai).toEqual(["pinterest-label"]);
  });

  it("repère les mots-clés de générateurs et de hashtags IA, en français et en anglais", () => {
    for (const text of [
      "Prompt Midjourney v7",
      "#aiart #interiordesign",
      "Image générée par IA",
      "généré par l'IA",
      "AI generated living room",
      "made with Stable Diffusion",
      "DALL-E 3",
      "Created with ChatGPT",
      "Leonardo AI render",
      "nano banana",
    ]) {
      expect(classifyPin(pin({ text })).ai, text).toContain("keywords");
    }
  });

  it("n'est pas dupe des faux amis (aide, maison, paire, chair, Thai, Dubai…)", () => {
    for (const text of [
      "Aide à la décoration d'une maison",
      "Une paire de chaises",
      "Chair design by Hans Wegner",
      "Thai restaurant interior",
      "Appartement à Dubai",
      "Fluxus art movement",
      "Firefly lights garland",
    ]) {
      expect(classifyPin(pin({ text })).ai, text).toEqual([]);
    }
  });

  it("signale un PNG ou WebP aux dimensions exactes d'un générateur", () => {
    expect(classifyPin(pin({ origWidth: 1024, origHeight: 1536, origExt: "png" })).ai).toEqual(["generator-size"]);
    expect(classifyPin(pin({ origWidth: 1536, origHeight: 2304, origExt: "webp" })).ai).toEqual(["generator-size"]);
  });

  it("signale un JPEG aux dimensions natives non carrées d'un générateur", () => {
    expect(classifyPin(pin({ origWidth: 832, origHeight: 1216, origExt: "jpg" })).ai).toEqual(["generator-size"]);
  });

  it("ne signale pas un JPEG carré de 1024 ni un JPEG agrandi : trop courant hors IA", () => {
    expect(classifyPin(pin({ origWidth: 1024, origHeight: 1024, origExt: "jpg" })).ai).toEqual([]);
    expect(classifyPin(pin({ origWidth: 2048, origHeight: 3072, origExt: "jpg" })).ai).toEqual([]);
  });

  it("ajoute les signaux d'un domaine source et d'une liste de signatures connues", () => {
    const verdict = classifyPin(pin({ domain: "www.lexica.art" }), {
      knownAiSignatures: new Set(["021d4d5654fac7b78aa99fac6db03a97"]),
    });
    expect(verdict.ai).toEqual(["ai-domain", "known-ai"]);
  });

  it("respecte la liste blanche de l'utilisateur", () => {
    const verdict = classifyPin(pin({ aiLabel: true, promoted: true }), {
      allowedSignatures: new Set(["021d4d5654fac7b78aa99fac6db03a97"]),
    });
    expect(verdict).toEqual({ ad: true, ai: [] });
  });

  it("ne mute pas l'épingle", () => {
    const p = pin({ text: "midjourney" });
    const copy = structuredClone(p);
    classifyPin(p);
    expect(p).toEqual(copy);
  });
});

describe("isSponsoredLabel", () => {
  it("reconnaît les mentions de sponsoring affichées par Pinterest", () => {
    for (const label of ["Sponsorisé", "Sponsorisée", "Sponsored", "Promu par", "Promoted by", "Gesponsert", "Patrocinado", "Annonce"]) {
      expect(isSponsoredLabel(label), label).toBe(true);
    }
  });

  it("ignore les caractères invisibles que Pinterest colle au libellé", () => {
    expect(isSponsoredLabel("Sponsorisé​")).toBe(true);
    expect(isSponsoredLabel("​Promu par Vis-Express‌")).toBe(true);
    expect(isAiLabelText("Modifié par IA​")).toBe(true);
  });

  it("ignore un texte ordinaire qui contient le mot", () => {
    expect(isSponsoredLabel("Comment j'ai sponsorisé mon voisin")).toBe(false);
    expect(isSponsoredLabel("Salon scandinave")).toBe(false);
  });
});

describe("isAiLabelText", () => {
  it("reconnaît le label IA affiché par Pinterest", () => {
    for (const label of ["Modifié par IA", "Modifiée par l'IA", "Généré par IA", "AI modified", "AI-generated", "KI-generiert", "Modificado con IA"]) {
      expect(isAiLabelText(label), label).toBe(true);
    }
  });

  it("ignore une description qui en parle", () => {
    expect(isAiLabelText("Ma déco modifiée par IA ? Jamais !")).toBe(false);
    expect(isAiLabelText("Salon")).toBe(false);
  });
});

describe("classifyPin — options", () => {
  it("peut désactiver l'indice des dimensions", () => {
    const p = pin({ origWidth: 1024, origHeight: 1536, origExt: "png" });
    expect(classifyPin(p, { sizeHeuristic: false }).ai).toEqual([]);
  });
});
