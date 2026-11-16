/**
 * Drawing, kept separate from the physics: it only reads the Simulation interface (cell centres,
 * angles, lengths, ids, anchors) and the chamber geometry, so either side can change on its own.
 *
 * Styles:
 *  - "simple":     each cell's capsule outline as one thin line, the walls and wall triangles as
 *                  lines, and the anchors (joints) with their springs; no fills or effects (default)
 *  - "diagnostic": flat colours, anchors and springs, and overlapping cells highlighted (the
 *                  viewer passes pairs deeper than 1% of the cell width: orange, red above the target)
 *
 * Cells are batched into a handful of paths per frame, and the per-frame cell buffer is reused, so
 * drawing allocates little. Line widths are in screen pixels, whatever the zoom.
 */

import { CHAMBER, Point, RGB, Simulation } from "./model.js";

export type RenderStyle = "simple" | "diagnostic";
export const RENDER_STYLES: RenderStyle[] = ["simple", "diagnostic"];

/** World area to fit on screen. */
export const VIEW = { minX: -55, maxX: 55, minY: 133, maxY: 205 };
export interface ViewRect { minX: number; maxX: number; minY: number; maxY: number; }

/** The chamber cavity (inside the walls) and the feeding channel it opens into. */
const CHAMBER_BOX = { minX: -50, maxX: 50, minY: 140, maxY: 200 };

export interface RenderOptions {
  style: RenderStyle;
  radius: number;
  /** World area to show (default VIEW: the whole chamber). */
  view?: ViewRect;
  /** Diagnostic style: pairs of cell indices (forEachCell order) and their penetration depths. */
  overlaps?: { i: Int32Array, j: Int32Array, depth: Float64Array, count: number };
  /** Diagnostic style: depth drawn in red (others orange). */
  targetDepth?: number;
}

export class ChamberRenderer {
  private n = 0;
  private x = new Float64Array(0); private y = new Float64Array(0);
  private ux = new Float64Array(0); private uy = new Float64Array(0);
  private region = new Uint8Array(0); // 0 initial, 1 wall zone, 2 centre (by colour)
  private regionColors: RGB[] = [];
  private readonly collect = (x: number, y: number, angle: number, length: number, color: RGB): void => {
    const k = this.n++;
    const h = length / 2;
    this.x[k] = x; this.y[k] = y;
    this.ux[k] = -Math.sin(angle) * h; this.uy[k] = Math.cos(angle) * h;
    let r = this.regionColors.indexOf(color);
    if (r < 0) { r = this.regionColors.length; this.regionColors.push(color); }
    this.region[k] = r;
  };

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  public draw(sim: Simulation, options: RenderOptions): void {
    const ctx = this.ctx, canvas = ctx.canvas;
    this.gather(sim);

    // World -> screen: fit the view, y pointing up
    const v = options.view ?? VIEW;
    const scale = Math.min(canvas.width / (v.maxX - v.minX), canvas.height / (v.maxY - v.minY));
    const cx = (v.minX + v.maxX) / 2, cy = (v.minY + v.maxY) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(scale, 0, 0, -scale, canvas.width / 2 - cx * scale, canvas.height / 2 + cy * scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (options.style) {
      case "simple": this.drawSimple(sim, scale, options.radius); break;
      case "diagnostic": this.drawDiagnostic(sim, scale, options); break;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ------------------------------------------------------------ styles

  private drawSimple(sim: Simulation, scale: number, radius: number): void {
    const ctx = this.ctx;
    this.clear("#ffffff");
    // Walls: the chamber outline and the small wall triangles
    this.strokeWalls("#000000", 1.5 / scale, 0);
    this.strokeTriangles("#000000", 1 / scale);
    // Cells: capsule outlines, drawn as a dark capsule with a white one 1 px narrower on each side
    // on top (two plain strokes, much faster than tracing outlines with arcs). The line lies just
    // inside each cell, so two touching cells both keep theirs.
    const line = 1 / scale;
    this.strokeCells(null, "#303030", 2 * radius);
    this.strokeCells(null, "#ffffff", Math.max(0, 2 * radius - 2 * line));
    // Joints: anchors that hold a cell (point and spring). Anchor points left behind by a cell
    // that divided hold nothing and are not drawn (the diagnostic view shows them).
    const marker = 5 / scale;
    ctx.beginPath();
    sim.forEachAnchor((x, y, cell: Point | null) => {
      if (!cell) { return; }
      ctx.moveTo(x, y); ctx.lineTo(cell.x, cell.y);
      ctx.rect(x - marker / 2, y - marker / 2, marker, marker);
    });
    ctx.strokeStyle = ctx.fillStyle = "#d02020";
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.fill(); // fills the anchor squares (the spring lines have no area)
  }

  private drawDiagnostic(sim: Simulation, scale: number, options: RenderOptions): void {
    const ctx = this.ctx;
    const radius = options.radius;
    this.clear("#ffffff");
    this.fillPdms("#dfe6df");
    this.strokeWalls("#333", 2 / scale, 0);
    for (let r = 0; r < this.regionColors.length; r++) {
      const c = this.regionColors[r];
      this.strokeCells((k) => this.region[k] === r, `rgb(${255 * c.r},${255 * c.g},${255 * c.b})`, 2 * radius);
    }
    // True outlines on top, so a cell reaching into a neighbour shows as a line crossing it
    this.outlineCells(radius, "rgba(0,0,0,0.75)", 1 / scale);

    // Overlapping cells (the pairs passed in): their axes, orange, or red when deeper than the target
    const o = options.overlaps;
    if (o) {
      for (const red of [false, true]) {
        ctx.beginPath();
        for (let p = 0; p < o.count; p++) {
          if ((o.depth[p] > (options.targetDepth ?? Infinity)) !== red) { continue; }
          for (const k of [o.i[p], o.j[p]]) {
            ctx.moveTo(this.x[k] - this.ux[k], this.y[k] - this.uy[k]);
            ctx.lineTo(this.x[k] + this.ux[k], this.y[k] + this.uy[k]);
          }
        }
        ctx.strokeStyle = red ? "#e00000" : "#ff9900";
        ctx.lineWidth = red ? 0.45 : 0.2;
        ctx.stroke();
      }
    }

    // Anchors and their springs
    ctx.beginPath();
    sim.forEachAnchor((x, y, cell: Point | null) => {
      if (cell) { ctx.moveTo(x, y); ctx.lineTo(cell.x, cell.y); }
    });
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
    ctx.fillStyle = "#000";
    const marker = 5 / scale; // anchor squares: 5 px whatever the zoom
    sim.forEachAnchor((x, y) => { ctx.fillRect(x - marker / 2, y - marker / 2, marker, marker); });
  }

  // ------------------------------------------------------------ pieces

  private gather(sim: Simulation): void {
    const n = sim.cellCount;
    if (this.x.length < n) {
      const m = Math.max(n, 2 * this.x.length, 1024);
      this.x = new Float64Array(m); this.y = new Float64Array(m);
      this.ux = new Float64Array(m); this.uy = new Float64Array(m);
      this.region = new Uint8Array(m);
    }
    this.n = 0;
    sim.forEachCell(this.collect);
  }

  /** Stroke the selected cells' axes as one path: a capsule of the given width each. */
  private strokeCells(select: ((k: number) => boolean) | null, style: string, width: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let k = 0; k < this.n; k++) {
      if (select && !select(k)) { continue; }
      const ux = this.ux[k], uy = this.uy[k];
      ctx.moveTo(this.x[k] - ux, this.y[k] - uy);
      ctx.lineTo(this.x[k] + ux, this.y[k] + uy);
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /** Stroke every cell's capsule outline (two half circles joined by straight sides) as one path. */
  private outlineCells(radius: number, style: string, width: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let k = 0; k < this.n; k++) {
      const x = this.x[k], y = this.y[k], ux = this.ux[k], uy = this.uy[k];
      const theta = Math.atan2(uy, ux); // direction from centre to end b
      ctx.moveTo(x + ux + radius * Math.cos(theta - Math.PI / 2), y + uy + radius * Math.sin(theta - Math.PI / 2));
      ctx.arc(x + ux, y + uy, radius, theta - Math.PI / 2, theta + Math.PI / 2);
      ctx.arc(x - ux, y - uy, radius, theta + Math.PI / 2, theta + 3 * Math.PI / 2);
      ctx.closePath();
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  private clear(color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(VIEW.minX - 10, VIEW.minY - 10, VIEW.maxX - VIEW.minX + 20, VIEW.maxY - VIEW.minY + 20);
  }

  /** PDMS: everything except the chamber cavity and the channel below it, plus the wall triangles. */
  private fillPdms(color: string): void {
    const ctx = this.ctx, B = CHAMBER_BOX, far = 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(VIEW.minX - far, B.minY, B.minX - VIEW.minX + far, VIEW.maxY - B.minY + far); // left of the chamber
    ctx.rect(B.maxX, B.minY, VIEW.maxX - B.maxX + far, VIEW.maxY - B.minY + far); // right
    ctx.rect(B.minX, B.maxY, B.maxX - B.minX, VIEW.maxY - B.maxY + far); // above
    for (const t of CHAMBER.triangles) {
      const [a, b, c] = t.vertices;
      ctx.moveTo(a.x + t.offset.x, a.y + t.offset.y);
      ctx.lineTo(b.x + t.offset.x, b.y + t.offset.y);
      ctx.lineTo(c.x + t.offset.x, c.y + t.offset.y);
      ctx.closePath();
    }
    ctx.fill();
  }

  /** Outline of the PDMS (chamber walls, and the channel's upper edge), offset `inset` into the chamber. */
  private strokeWalls(style: string, width: number, inset: number): void {
    const ctx = this.ctx, B = CHAMBER_BOX;
    ctx.beginPath();
    ctx.moveTo(VIEW.minX - 20, B.minY - inset);
    ctx.lineTo(B.minX + inset, B.minY - inset);
    ctx.lineTo(B.minX + inset, B.maxY - inset);
    ctx.lineTo(B.maxX - inset, B.maxY - inset);
    ctx.lineTo(B.maxX - inset, B.minY - inset);
    ctx.lineTo(VIEW.maxX + 20, B.minY - inset);
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /** Outlines of the small wall triangles. */
  private strokeTriangles(style: string, width: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (const t of CHAMBER.triangles) {
      const [a, b, c] = t.vertices;
      ctx.moveTo(a.x + t.offset.x, a.y + t.offset.y);
      ctx.lineTo(b.x + t.offset.x, b.y + t.offset.y);
      ctx.lineTo(c.x + t.offset.x, c.y + t.offset.y);
      ctx.closePath();
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
