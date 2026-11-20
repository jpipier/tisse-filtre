import { describe, expect, it } from "vitest";
import { forceGenAiFilter, forceGenAiFilterInBody } from "../request-filter";

const searchUrl = (options: Record<string, unknown>) =>
  `https://fr.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F&data=${encodeURIComponent(
    JSON.stringify({ options, context: {} }),
  )}&_=1`;

const optionsOf = (url: string) => JSON.parse(new URL(url, "https://fr.pinterest.com").searchParams.get("data") ?? "{}").options;

describe("forceGenAiFilter", () => {
  it("active filter_genai quand la requête le prévoit", () => {
    const url = forceGenAiFilter(searchUrl({ query: "salon", filter_genai: false }));
    expect(optionsOf(url)).toEqual({ query: "salon", filter_genai: true });
  });

  it("conserve les autres paramètres de l'URL", () => {
    const url = new URL(forceGenAiFilter(searchUrl({ filter_genai: false })));
    expect(url.searchParams.get("source_url")).toBe("/search/pins/");
    expect(url.searchParams.get("_")).toBe("1");
  });

  it("accepte une URL relative et la renvoie relative", () => {
    const relative = searchUrl({ filter_genai: false }).replace("https://fr.pinterest.com", "");
    const url = forceGenAiFilter(relative);
    expect(url.startsWith("/resource/")).toBe(true);
    expect(optionsOf(url).filter_genai).toBe(true);
  });

  it("ne touche pas aux requêtes sans filter_genai, ni hors /resource/", () => {
    const other = searchUrl({ query: "salon" });
    expect(forceGenAiFilter(other)).toBe(other);
    expect(forceGenAiFilter("https://fr.pinterest.com/search/pins/?q=x")).toBe("https://fr.pinterest.com/search/pins/?q=x");
    expect(forceGenAiFilter("https://fr.pinterest.com/resource/X/get/?data=pas-du-json")).toBe(
      "https://fr.pinterest.com/resource/X/get/?data=pas-du-json",
    );
  });

  it("ne touche pas à une requête où le filtre est déjà actif", () => {
    const url = searchUrl({ filter_genai: true });
    expect(forceGenAiFilter(url)).toBe(url);
  });
});

describe("forceGenAiFilterInBody", () => {
  it("active filter_genai dans un corps de formulaire POST", () => {
    const body = new URLSearchParams({ source_url: "/x", data: JSON.stringify({ options: { filter_genai: false } }) }).toString();
    const out = new URLSearchParams(forceGenAiFilterInBody(body));
    expect(JSON.parse(out.get("data") ?? "").options.filter_genai).toBe(true);
    expect(out.get("source_url")).toBe("/x");
  });

  it("renvoie le corps tel quel s'il n'y a rien à changer", () => {
    expect(forceGenAiFilterInBody("a=1")).toBe("a=1");
  });
});
