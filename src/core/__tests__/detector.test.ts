import { describe, expect, it } from "vitest";
import { buildDetectorUrl, parseDetectorResponse } from "../detector";

describe("buildDetectorUrl", () => {
  it("construit la requête Sightengine (modèle genai) sur l'image réduite", () => {
    const url = new URL(
      buildDetectorUrl("https://i.pinimg.com/originals/7f/6b/17/7f6b1743aa3170a6cff86c2d892735d1.png", { apiUser: "u", apiSecret: "s" }),
    );
    expect(url.origin + url.pathname).toBe("https://api.sightengine.com/1.0/check.json");
    expect(url.searchParams.get("models")).toBe("genai");
    expect(url.searchParams.get("url")).toBe("https://i.pinimg.com/736x/7f/6b/17/7f6b1743aa3170a6cff86c2d892735d1.jpg");
    expect(url.searchParams.get("api_user")).toBe("u");
    expect(url.searchParams.get("api_secret")).toBe("s");
  });

  it("refuse une image qui ne vient pas de i.pinimg.com", () => {
    expect(() => buildDetectorUrl("https://evil.example/x.png", { apiUser: "u", apiSecret: "s" })).toThrow();
  });
});

describe("parseDetectorResponse", () => {
  it("lit le score ai_generated", () => {
    expect(parseDetectorResponse({ status: "success", type: { ai_generated: 0.97 } })).toEqual({ ok: true, score: 0.97 });
  });

  it("signale une erreur de l'API sans lever d'exception", () => {
    expect(parseDetectorResponse({ status: "failure", error: { message: "quota" } })).toEqual({ ok: false, error: "quota" });
    expect(parseDetectorResponse("n'importe quoi")).toEqual({ ok: false, error: "réponse inattendue" });
  });
});
