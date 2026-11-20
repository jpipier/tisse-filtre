import { describe, expect, it } from "vitest";
import { extractPins, signatureFromImageUrl } from "../pins";

const images = (ext: string, width: number, height: number) => ({
  "236x": { width: 236, height: 354, url: "https://i.pinimg.com/236x/02/1d/4d/021d4d5654fac7b78aa99fac6db03a97.jpg" },
  orig: { width, height, url: `https://i.pinimg.com/originals/02/1d/4d/021d4d5654fac7b78aa99fac6db03a97.${ext}` },
});

describe("signatureFromImageUrl", () => {
  it("extrait la signature d'une URL i.pinimg.com, quelle que soit la taille", () => {
    expect(signatureFromImageUrl("https://i.pinimg.com/236x/7f/6b/17/7f6b1743aa3170a6cff86c2d892735d1.jpg")).toBe(
      "7f6b1743aa3170a6cff86c2d892735d1",
    );
    expect(signatureFromImageUrl("https://i.pinimg.com/originals/7f/6b/17/7f6b1743aa3170a6cff86c2d892735d1.png")).toBe(
      "7f6b1743aa3170a6cff86c2d892735d1",
    );
  });

  it("renvoie null pour une URL étrangère ou invalide", () => {
    expect(signatureFromImageUrl("https://example.com/7f6b1743aa3170a6cff86c2d892735d1.jpg")).toBeNull();
    expect(signatureFromImageUrl("pas une url")).toBeNull();
    expect(signatureFromImageUrl("https://i.pinimg.com/75x75_RS/ab/cd/ef/avatar.jpg")).toBeNull();
  });
});

describe("extractPins", () => {
  it("trouve les épingles à n'importe quelle profondeur d'une réponse de l'API", () => {
    const response = {
      resource_response: {
        data: {
          results: [
            { type: "pin", id: "123", image_signature: "021d4d5654fac7b78aa99fac6db03a97", images: images("png", 1024, 1536) },
            { type: "board", id: "9" },
          ],
        },
      },
    };
    const pins = extractPins(response);
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({
      id: "123",
      signature: "021d4d5654fac7b78aa99fac6db03a97",
      origWidth: 1024,
      origHeight: 1536,
      origExt: "png",
      promoted: false,
    });
  });

  it("déduit la signature de l'URL d'image quand image_signature manque", () => {
    const [pin] = extractPins([{ type: "pin", id: "1", images: images("jpg", 800, 1200) }]);
    expect(pin.signature).toBe("021d4d5654fac7b78aa99fac6db03a97");
    expect(pin.origExt).toBe("jpg");
  });

  it("rassemble le texte utile : titre, description, alt, domaine, lien", () => {
    const [pin] = extractPins({
      type: "pin",
      id: "1",
      title: "Salon cosy",
      grid_title: "Salon cosy",
      description: "Rendu #midjourney",
      auto_alt_text: "un salon beige",
      seo_alt_text: "salon",
      domain: "exemple.fr",
      link: "https://exemple.fr/article",
      images: images("jpg", 800, 1200),
    });
    expect(pin.text).toContain("Rendu #midjourney");
    expect(pin.text).toContain("Salon cosy");
    expect(pin.domain).toBe("exemple.fr");
    expect(pin.link).toBe("https://exemple.fr/article");
  });

  it("repère une épingle sponsorisée par is_promoted, promoter ou un identifiant de campagne", () => {
    const base = { type: "pin", images: images("jpg", 800, 1200) };
    const pins = extractPins([
      { ...base, id: "1", is_promoted: true },
      { ...base, id: "2", promoter: { id: "42", username: "marque" } },
      { ...base, id: "3", campaign_id: "5551" },
      { ...base, id: "4", ad_match_reason: 3 },
      { ...base, id: "5", is_promoted: false, promoter: null },
    ]);
    expect(pins.map((p) => p.promoted)).toEqual([true, true, true, true, false]);
  });

  it("repère un label IA posé par Pinterest, quel que soit le nom exact du champ", () => {
    const base = { type: "pin", images: images("jpg", 800, 1200) };
    const pins = extractPins([
      { ...base, id: "1", is_ai_generated: true },
      { ...base, id: "2", gen_ai_label: { type: "AI_MODIFIED" } },
      { ...base, id: "3", ai_modified_label: "modifié par IA" },
      { ...base, id: "4", is_ai_generated: false, gen_ai_label: null },
      { ...base, id: "5", aggregated_pin_data: { is_ai_generated: true } },
      { ...base, id: "6", gen_ai_label: { type: "NONE" } },
    ]);
    expect(pins.map((p) => p.aiLabel)).toEqual([true, true, true, false, true, false]);
  });

  it("ne confond pas des champs sans rapport contenant « ai » (rail, email, detail…)", () => {
    const [pin] = extractPins({
      type: "pin",
      id: "1",
      images: images("jpg", 800, 1200),
      rich_metadata: { email: "a@b.c" },
      detail_ai: undefined,
      details: "x",
      is_eligible_for_ai_tools: true,
    });
    expect(pin.aiLabel).toBe(false);
  });

  it("dédoublonne par identifiant en fusionnant les informations", () => {
    const pins = extractPins([
      { type: "pin", id: "1", images: images("png", 1024, 1536) },
      { type: "pin", id: "1", description: "ai art", is_promoted: true },
    ]);
    expect(pins).toHaveLength(1);
    expect(pins[0].text).toContain("ai art");
    expect(pins[0].promoted).toBe(true);
    expect(pins[0].origExt).toBe("png");
  });

  it("résiste aux cycles et aux valeurs exotiques", () => {
    const a: Record<string, unknown> = { type: "pin", id: "1" };
    a.self = a;
    expect(() => extractPins(a)).not.toThrow();
    expect(extractPins(null)).toEqual([]);
    expect(extractPins("texte")).toEqual([]);
  });
});
