import { describe, expect, it } from "vitest";
import { removalReason, removePins, type RemovalConfig } from "../response-filter";
import type { PinInfo } from "../pins";

const image = (ext: string, width: number, height: number) => ({
  orig: { width, height, url: `https://i.pinimg.com/originals/02/1d/4d/021d4d5654fac7b78aa99fac6db03a97.${ext}` },
});

const photo = { type: "pin", id: "1", images: image("jpg", 3024, 4032) };
const ad = { type: "pin", id: "2", is_promoted: true, images: image("jpg", 3024, 4032) };
const ai = { type: "pin", id: "3", description: "#midjourney", images: image("jpg", 3024, 4032) };

const config: RemovalConfig = {
  removeAds: true,
  removeAi: true,
  sizeHeuristic: true,
  knownAi: new Set(),
  allowed: new Set(),
};

describe("removalReason", () => {
  const info = (overrides: Partial<PinInfo>): PinInfo => ({
    id: "1",
    signature: "abc",
    text: "",
    domain: null,
    link: null,
    origWidth: null,
    origHeight: null,
    origExt: null,
    promoted: false,
    aiLabel: false,
    ...overrides,
  });

  it("renvoie « ad » pour une pub, « ai » pour une image IA, null sinon", () => {
    expect(removalReason(info({ promoted: true }), config)).toBe("ad");
    expect(removalReason(info({ aiLabel: true }), config)).toBe("ai");
    expect(removalReason(info({}), config)).toBeNull();
  });

  it("respecte les réglages et la liste blanche", () => {
    expect(removalReason(info({ promoted: true }), { ...config, removeAds: false })).toBeNull();
    expect(removalReason(info({ aiLabel: true }), { ...config, removeAi: false })).toBeNull();
    expect(removalReason(info({ aiLabel: true }), { ...config, allowed: new Set(["abc"]) })).toBeNull();
    expect(removalReason(info({}), { ...config, knownAi: new Set(["abc"]) })).toBe("ai");
  });
});

describe("removePins", () => {
  it("retire les pubs et les images IA des listes, sans toucher aux autres", () => {
    const response = { resource_response: { data: { results: [photo, ad, ai] }, bookmark: "Y2" } };
    const { value, removed } = removePins(response, config);
    expect(value).toEqual({ resource_response: { data: { results: [photo] }, bookmark: "Y2" } });
    expect(removed.map((r) => [r.pin.id, r.reason])).toEqual([
      ["2", "ad"],
      ["3", "ai"],
    ]);
  });

  it("ne mute pas la réponse d'origine", () => {
    const response = { data: [photo, ad] };
    const copy = structuredClone(response);
    removePins(response, config);
    expect(response).toEqual(copy);
  });

  it("renvoie la même référence quand il n'y a rien à retirer", () => {
    const response = { data: [photo], other: { nested: [1, 2] } };
    const { value, removed } = removePins(response, config);
    expect(value).toBe(response);
    expect(removed).toEqual([]);
  });

  it("ne retire pas une épingle qui n'est pas un élément de liste (épingle principale d'une page)", () => {
    const response = { data: { ...ad, related: [ai, photo] } };
    const { value } = removePins(response, config);
    expect(value).toEqual({ data: { ...ad, related: [photo] } });
  });

  it("retire aussi les épingles dans des listes imbriquées (modules, carrousels)", () => {
    const response = { data: [{ type: "story", objects: [ad, photo] }, ai] };
    const { value, removed } = removePins(response, config);
    expect(value).toEqual({ data: [{ type: "story", objects: [photo] }] });
    expect(removed).toHaveLength(2);
  });

  it("laisse passer les valeurs exotiques", () => {
    expect(removePins(null, config).value).toBeNull();
    expect(removePins("texte", config).value).toBe("texte");
  });
});
