/**
 * Overlap check: penetration depth between every pair of touching cells (capsule–capsule), and
 * of cells into the chamber walls, measured on the live simulation at full precision.
 *
 * (The exported states are rounded to 2 decimals — `an` to 0.01·π — which alone can move a cell
 * tip by ~0.03, so overlaps must be measured here, not from the exported file.)
 *
 * Each cell is a capsule: a segment between its end-cap centres, swept by `radius`. Two cells
 * overlap by 2·radius − (distance between their segments) when that is positive.
 */

import { CHAMBER, Simulation } from "./model.js";

/**
 * Target: max cell–cell penetration below this fraction of the cell width. Originally 0.05; relaxed
 * to 0.08 on 14 November in exchange for fewer solver iterations (faster steps; NOTES.md).
 */
export const OVERLAP_TARGET_FRACTION = 0.08;
/** Steps to let the random initial placement (heavily overlapping) relax before the target applies. */
export const OVERLAP_WARMUP_STEPS = 3000;

export interface OverlapStats {
  step: number;
  cells: number;
  /** Pairs of cells that overlap at all (penetration > 0). */
  overlappingPairs: number;
  /** Deepest cell–cell penetration. */
  maxDepth: number;
  /** Mean penetration over the overlapping pairs (0 if there are none). */
  meanDepth: number;
  /** 99th percentile of penetration over the overlapping pairs. */
  p99Depth: number;
  /** Pairs deeper than the target. */
  pairsOverTarget: number;
  /** Deepest penetration of a cell into the side or top walls or their triangles. */
  maxWallDepth: number;
  /** Where the deepest cell–cell overlap is (midpoint of the two centres) and the deepest wall contact (cell centre). */
  maxAt: { x: number, y: number };
  maxWallAt: { x: number, y: number };
}

export const OVERLAP_CSV_HEADER =
  "step,cells,overlapping_pairs,max_depth,mean_depth,p99_depth,pairs_over_target,max_wall_depth,max_depth_fraction_of_width,max_x,max_y,wall_x,wall_y";

export function overlapCsvRow(s: OverlapStats, width: number): string {
  return [s.step, s.cells, s.overlappingPairs, s.maxDepth.toFixed(5), s.meanDepth.toFixed(5), s.p99Depth.toFixed(5),
    s.pairsOverTarget, s.maxWallDepth.toFixed(5), (s.maxDepth / width).toFixed(5),
    s.maxAt.x.toFixed(2), s.maxAt.y.toFixed(2), s.maxWallAt.x.toFixed(2), s.maxWallAt.y.toFixed(2)].join(",");
}

/** Squared distance between segments p1–q1 and p2–q2 (Ericson, Real-Time Collision Detection, 5.1.9). */
export function segmentDistanceSquared(
  p1x: number, p1y: number, q1x: number, q1y: number,
  p2x: number, p2y: number, q2x: number, q2y: number,
): number {
  const d1x = q1x - p1x, d1y = q1y - p1y;
  const d2x = q2x - p2x, d2y = q2y - p2y;
  const rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  const EPS = 1e-12;
  let s: number, t: number;
  if (a <= EPS && e <= EPS) {
    s = 0; t = 0;
  } else if (a <= EPS) {
    s = 0; t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= EPS) {
      t = 0; s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const dx = p1x + d1x * s - (p2x + d2x * t);
  const dy = p1y + d1y * s - (p2y + d2y * t);
  return dx * dx + dy * dy;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Measures overlaps; keeps its buffers between calls so repeated checks don't allocate. */
export class OverlapMeter {
  private ax = new Float64Array(0); private ay = new Float64Array(0);
  private bx = new Float64Array(0); private by = new Float64Array(0);
  private cx = new Float64Array(0); private cy = new Float64Array(0);
  private binOf = new Int32Array(0); private order = new Int32Array(0);
  private binStart = new Int32Array(0);
  private depths = new Float64Array(0);

  /**
   * @param radius cell radius (half the width)
   * @param targetDepth depth counted in `pairsOverTarget`
   * @param onPair optional callback for every overlapping pair (cell indices in forEachCell order)
   */
  public measure(sim: Simulation, radius: number, targetDepth: number,
    onPair?: (i: number, j: number, depth: number) => void): OverlapStats {
    // Gather segments
    const n = sim.cellCount;
    this.ensure(n);
    const { ax, ay, bx, by, cx, cy } = this;
    let k = 0, maxLength = 0;
    sim.forEachCell((x, y, angle, length) => {
      const h = length / 2, ux = -Math.sin(angle) * h, uy = Math.cos(angle) * h; // long axis = local y
      ax[k] = x - ux; ay[k] = y - uy; bx[k] = x + ux; by[k] = y + uy; cx[k] = x; cy[k] = y;
      if (length > maxLength) { maxLength = length; }
      k++;
    });

    // Bin cell centres on a grid at least one "max reach" wide: overlapping cells are in adjacent bins
    const size = maxLength + 2 * radius + 1e-6;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      if (cx[i] < minX) { minX = cx[i]; } if (cx[i] > maxX) { maxX = cx[i]; }
      if (cy[i] < minY) { minY = cy[i]; } if (cy[i] > maxY) { maxY = cy[i]; }
    }
    const nx = n > 0 ? Math.floor((maxX - minX) / size) + 1 : 1;
    const ny = n > 0 ? Math.floor((maxY - minY) / size) + 1 : 1;
    const bins = nx * ny;
    if (this.binStart.length < bins + 1) { this.binStart = new Int32Array(bins + 1); }
    const binStart = this.binStart, binOf = this.binOf, order = this.order;
    binStart.fill(0, 0, bins + 1);
    for (let i = 0; i < n; i++) {
      const b = Math.floor((cy[i] - minY) / size) * nx + Math.floor((cx[i] - minX) / size);
      binOf[i] = b;
      binStart[b + 1]++;
    }
    for (let b = 0; b < bins; b++) { binStart[b + 1] += binStart[b]; }
    const fill = binStart.slice(0, bins); // write cursor per bin (one small allocation per call)
    for (let i = 0; i < n; i++) { order[fill[binOf[i]]++] = i; }

    // Test each pair once (j > i) within the 3x3 neighbourhood
    const touch = 2 * radius, touch2 = touch * touch;
    let pairs = 0, sum = 0, maxDepth = 0, overTarget = 0;
    const maxAt = { x: NaN, y: NaN }, maxWallAt = { x: NaN, y: NaN };
    for (let i = 0; i < n; i++) {
      const bxi = binOf[i] % nx, byi = (binOf[i] - bxi) / nx;
      for (let gy = Math.max(0, byi - 1); gy <= Math.min(ny - 1, byi + 1); gy++) {
        for (let gx = Math.max(0, bxi - 1); gx <= Math.min(nx - 1, bxi + 1); gx++) {
          const b = gy * nx + gx;
          for (let o = binStart[b]; o < binStart[b + 1]; o++) {
            const j = order[o];
            if (j <= i) { continue; }
            const ddx = cx[i] - cx[j], ddy = cy[i] - cy[j];
            if (ddx * ddx + ddy * ddy > size * size) { continue; }
            const d2 = segmentDistanceSquared(ax[i], ay[i], bx[i], by[i], ax[j], ay[j], bx[j], by[j]);
            if (d2 >= touch2) { continue; }
            const depth = touch - Math.sqrt(d2);
            if (this.depths.length <= pairs) { const grown = new Float64Array(2 * pairs + 64); grown.set(this.depths); this.depths = grown; }
            this.depths[pairs++] = depth;
            sum += depth;
            if (depth > maxDepth) { maxDepth = depth; maxAt.x = (cx[i] + cx[j]) / 2; maxAt.y = (cy[i] + cy[j]) / 2; }
            if (depth > targetDepth) { overTarget++; }
            if (onPair) { onPair(i, j, depth); }
          }
        }
      }
    }

    // Walls: side and top edges, and the small triangles along them. Only cells close enough to
    // reach a wall are tested. A cell axis crossing a wall counts as depth = radius.
    let maxWallDepth = 0;
    const reach = maxLength / 2 + radius + 1.5; // triangles stick 1 unit into the chamber
    const segments = wallSegments();
    for (let i = 0; i < n; i++) {
      if (cx[i] > -50 + reach && cx[i] < 50 - reach && cy[i] < 200 - reach) { continue; }
      for (let w = 0; w < segments.length; w += 4) {
        const d2 = segmentDistanceSquared(ax[i], ay[i], bx[i], by[i], segments[w], segments[w + 1], segments[w + 2], segments[w + 3]);
        if (d2 < radius * radius) {
          const depth = radius - Math.sqrt(d2);
          if (depth > maxWallDepth) { maxWallDepth = depth; maxWallAt.x = cx[i]; maxWallAt.y = cy[i]; }
        }
      }
    }

    return {
      step: sim.stepCount, cells: n, overlappingPairs: pairs, maxDepth,
      meanDepth: pairs > 0 ? sum / pairs : 0,
      p99Depth: percentile(this.depths.subarray(0, pairs), 0.99),
      pairsOverTarget: overTarget, maxWallDepth, maxAt, maxWallAt,
    };
  }

  private ensure(n: number): void {
    if (this.ax.length >= n) { return; }
    const m = Math.max(n, 2 * this.ax.length, 1024);
    this.ax = new Float64Array(m); this.ay = new Float64Array(m);
    this.bx = new Float64Array(m); this.by = new Float64Array(m);
    this.cx = new Float64Array(m); this.cy = new Float64Array(m);
    this.binOf = new Int32Array(m); this.order = new Int32Array(m);
  }
}

let wallSegmentCache: Float64Array | null = null;

/** Chamber edges and triangle sides as a flat list of segments (x1, y1, x2, y2, ...). */
function wallSegments(): Float64Array {
  if (wallSegmentCache) { return wallSegmentCache; }
  const list: number[] = [];
  for (const [a, b] of CHAMBER.edges) { list.push(a.x, a.y, b.x, b.y); }
  for (const t of CHAMBER.triangles) {
    for (let k = 0; k < 3; k++) {
      const a = t.vertices[k], b = t.vertices[(k + 1) % 3];
      list.push(a.x + t.offset.x, a.y + t.offset.y, b.x + t.offset.x, b.y + t.offset.y);
    }
  }
  wallSegmentCache = Float64Array.from(list);
  return wallSegmentCache;
}

function percentile(values: Float64Array, q: number): number {
  if (values.length === 0) { return 0; }
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}
