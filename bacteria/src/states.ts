/**
 * Records simulation states in the LowRes.json format:
 *
 *   {"1":[{"x":3.99,"y":166.12,"id":1,"an":0.46,"le":3.7}, ...], "2":[...], ..., "lineage":{"1":0, ...}}
 *
 * - snapshot keys count snapshots ("1", "2", ...), cells sorted by ascending id
 * - x, y: body centre; an: orientation as a fraction of π in [0, 1]; le: distance between
 *   the end-cap centres; all rounded to 2 decimals
 * - lineage: child id -> parent id (0 for the initial cells), written last
 */

export interface CellState {
  x: number;
  y: number;
  id: number;
  an: number;
  le: number;
}

/** Round to 2 decimals (the LowRes coarse graining). */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export class StateRecorder {
  /** One serialized `"n":[...]` entry per snapshot (kept as text to save memory). */
  private readonly snapshotParts: string[] = [];
  /** lineage[childId] = parentId */
  private readonly lineage: number[] = [];
  private maxId: number = 0;

  public get snapshotCount(): number {
    return this.snapshotParts.length;
  }

  public get idCount(): number {
    return this.maxId;
  }

  public addLineage(childId: number, parentId: number): void {
    this.lineage[childId] = parentId;
    if (childId > this.maxId) { this.maxId = childId; }
  }

  /** Store one snapshot. Values are rounded here; cells are sorted by id. */
  public addSnapshot(cells: CellState[]): void {
    const sorted = cells.slice().sort((a, b) => a.id - b.id);
    const text = sorted.map((c) => JSON.stringify({
      x: round2(c.x),
      y: round2(c.y),
      id: c.id,
      an: round2(c.an),
      le: round2(c.le),
    })).join(",");
    this.snapshotParts.push(`"${this.snapshotParts.length + 1}":[${text}]`);
  }

  /**
   * The whole file as a list of string pieces, in order. Write them one by one (Node) or
   * pass them to `new Blob(pieces)` (browser), so no single giant string is ever built.
   */
  public toPieces(): string[] {
    const pieces: string[] = ["{"];
    this.snapshotParts.forEach((part, i) => {
      if (i > 0) { pieces.push(","); }
      pieces.push(part);
    });
    if (this.snapshotParts.length > 0) { pieces.push(","); }
    pieces.push(`"lineage":{`);
    const CHUNK = 10000;
    for (let start = 1; start <= this.maxId; start += CHUNK) {
      const entries: string[] = [];
      for (let id = start; id < start + CHUNK && id <= this.maxId; id++) {
        entries.push(`"${id}":${this.lineage[id]}`);
      }
      pieces.push((start > 1 ? "," : "") + entries.join(","));
    }
    pieces.push("}}");
    return pieces;
  }
}
