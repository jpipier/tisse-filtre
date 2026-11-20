import { describe, expect, it } from "vitest";
import { compactColumns, parseTranslate, type Tile } from "../masonry";

const tile = (key: string, x: number, y: number, height: number, hidden = false): Tile => ({ key, x, y, height, hidden });

describe("parseTranslate", () => {
  it("lit la position écrite par la mosaïque de Pinterest", () => {
    expect(parseTranslate("translateX(8px) translateY(1101px)")).toEqual({ x: 8, y: 1101 });
    expect(parseTranslate("translateX(508.5px) translateY(0px)")).toEqual({ x: 508.5, y: 0 });
  });

  it("renvoie null pour une transformation inconnue", () => {
    expect(parseTranslate("")).toBeNull();
    expect(parseTranslate("scale(2)")).toBeNull();
  });
});

describe("compactColumns", () => {
  // Deux colonnes, écart de 16 px entre les épingles.
  const column0 = [tile("a", 0, 0, 300), tile("b", 0, 316, 200), tile("c", 0, 532, 400)];
  const column1 = [tile("d", 250, 0, 250), tile("e", 250, 266, 300)];

  it("ne déplace rien quand aucune épingle n'est masquée", () => {
    expect(compactColumns([...column0, ...column1])).toEqual(new Map());
  });

  it("remonte les épingles situées sous une épingle masquée, dans sa colonne seulement", () => {
    const tiles = [tile("a", 0, 0, 300, true), column0[1], column0[2], ...column1];
    expect(compactColumns(tiles)).toEqual(
      new Map([
        ["b", 0],
        ["c", 216],
      ]),
    );
  });

  it("cumule plusieurs épingles masquées de la même colonne", () => {
    const tiles = [tile("a", 0, 0, 300, true), tile("b", 0, 316, 200, true), column0[2]];
    expect(compactColumns(tiles)).toEqual(new Map([["c", 0]]));
  });

  it("utilise un écart de 16 px quand la colonne ne permet pas de le mesurer", () => {
    // 200 px entre « a » et « b » : écart invraisemblable, donc non retenu comme mesure.
    const tiles = [tile("a", 0, 0, 300, true), tile("b", 0, 500, 100)];
    expect(compactColumns(tiles)).toEqual(new Map([["b", 184]]));
  });

  it("tient compte d'une épingle masquée qui n'est plus dans le DOM (défilement virtuel)", () => {
    // « a » est démontée par Pinterest mais mémorisée : « c » reste remontée de 316 px.
    const tiles = [tile("a", 0, 0, 300, true), column0[2], ...column1];
    const moved = compactColumns(tiles);
    expect(moved.get("c")).toBe(216);
  });

  it("ignore une épingle masquée de hauteur inconnue", () => {
    expect(compactColumns([tile("a", 0, 0, 0, true), column0[1]])).toEqual(new Map());
  });

  it("tolère un léger écart de position horizontale dans une colonne", () => {
    const tiles = [tile("a", 8, 0, 300, true), tile("b", 8.4, 316, 200)];
    expect(compactColumns(tiles)).toEqual(new Map([["b", 0]]));
  });
});
