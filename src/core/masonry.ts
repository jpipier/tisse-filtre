// Tassement de la mosaïque de Pinterest après masquage d'épingles. Pinterest place chaque épingle en absolu
// (translateX/translateY) : une épingle masquée laisse un trou. On remonte les épingles situées dessous,
// dans la même colonne, de la hauteur des épingles masquées au-dessus d'elles. Pur et déterministe.

export interface Tile {
  key: string;
  /** Position d'origine calculée par Pinterest. */
  x: number;
  y: number;
  height: number;
  hidden: boolean;
}

const DEFAULT_GAP = 16;
const SAME_COLUMN = 2;
const MAX_PLAUSIBLE_GAP = 100;

const TRANSLATE = /translateX\((-?[\d.]+)px\)\s*translateY\((-?[\d.]+)px\)/;

/** Position lue dans « translateX(8px) translateY(1101px) », ou null. */
export function parseTranslate(transform: string): { x: number; y: number } | null {
  const match = TRANSLATE.exec(transform);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function groupByColumn(tiles: Tile[]): Tile[][] {
  const columns: Tile[][] = [];
  for (const tile of tiles) {
    const column = columns.find((c) => Math.abs(c[0].x - tile.x) <= SAME_COLUMN);
    if (column) column.push(tile);
    else columns.push([tile]);
  }
  return columns.map((c) => [...c].sort((a, b) => a.y - b.y));
}

/** Écart vertical entre deux épingles, mesuré sur la mosaïque (médiane), 16 px à défaut. */
function measureGap(columns: Tile[][]): number {
  const gaps: number[] = [];
  for (const column of columns) {
    for (let i = 1; i < column.length; i++) {
      const previous = column[i - 1];
      if (previous.height <= 0) continue;
      const gap = column[i].y - (previous.y + previous.height);
      if (gap >= 0 && gap <= MAX_PLAUSIBLE_GAP) gaps.push(gap);
    }
  }
  if (gaps.length === 0) return DEFAULT_GAP;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Nouvelle position verticale des épingles visibles à déplacer (clé → y).
 * Les épingles masquées peuvent ne plus être dans le DOM : elles comptent tant qu'on les fournit.
 */
export function compactColumns(tiles: Tile[]): Map<string, number> {
  const columns = groupByColumn(tiles);
  const gap = measureGap(columns);
  const moves = new Map<string, number>();

  for (const column of columns) {
    let shift = 0;
    for (const tile of column) {
      if (tile.hidden) {
        if (tile.height > 0) shift += tile.height + gap;
        continue;
      }
      if (shift > 0) moves.set(tile.key, tile.y - shift);
    }
  }
  return moves;
}
