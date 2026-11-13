/**
 * Engine-independent part of the microfluidic biofilm model: parameters, chamber geometry,
 * cell mass, and the interface every physics engine implementation provides.
 *
 * Implementations: box2d-simulation.ts (the original) and rapier-simulation.ts.
 * Pick one with createSimulation() in engines.ts.
 */

import { StateRecorder } from "./states.js";

export const ENGINES = ["box2d", "rapier"] as const;
export type Engine = typeof ENGINES[number];

/** All tunable parameters. Override any of them via the constructor (or `--set` in run.js). */
export const DEFAULT_PARAMS = {
  // --- physics stepping ---
  hertz: 60, // time step = 1 / hertz
  // Box2D only (same values the testbed used)
  velocityIterations: 20,
  positionIterations: 20,
  particleIterations: 10,
  // Rapier only. Defaults chosen by sweeping for the overlap target (NOTES.md): Rapier's own defaults
  // (4 iterations, 30 Hz) let a packed colony compress far beyond it.
  rapierSubsteps: 1, // world.step() calls per simulation step, each 1 / (hertz * rapierSubsteps) long
  rapierSolverIterations: 12, // Rapier's default: 4
  rapierPgsIterations: 1, // Rapier's default
  rapierContactFrequency: 720, // contact stiffness (natural frequency, Hz); 0 = Rapier's default (30)
  rapierRefreshContacts: 1, // 1: replace a cell's collider when it grows, so Rapier recomputes its contacts (see rapier-simulation.ts)

  // --- chamber ---
  minX: -50, maxX: 50, // cells leaving this range are removed
  minY: 140, maxY: 200,

  // --- initial population ---
  initialCells: 1000,
  // Cell sizes below are 0.8x the testbed's (radius 0.5, minSize 3, maxSize 6, reproductive length 6 +/- 2.5/2).
  minSize: 2.4, maxSize: 4.8, // initial length = minSize + 0.2 * U(0,1) * (maxSize - minSize)

  // --- growth and division (applied every growthInterval steps) ---
  growthInterval: 25,
  rate: 0.002 * 0.8, // per growth event: length *= 1 + rate
  wallRate: 0.002 * 0.8, // growth rate near the side walls
  wallZone: 20, // "near the wall" = within this distance of minX / maxX
  reproductionProportionMin: 0.3, // daughter 1 gets min + U(0,1) * range of the parent
  reproductionProportionRange: 0.2,
  reproductiveLengthMean: 4.8, // division length = mean + (U(0,1) - 0.5) * spread
  reproductiveLengthSpread: 2.0,
  // 1: the two daughters exactly fill the parent's outline. 0: the testbed's placement, which shifts
  // both daughters along the axis by radius * (proportion - 1/2), so one daughter's tip pokes up to
  // 0.2 * radius (10% of the cell width) past the parent's end, into any neighbour touching it there.
  centredDivision: 1,
  randomDeathProbability: 0.001 * 0.15, // per cell per growth event

  // --- drag (applied on growth steps only, once per Box2D fixture, as in the original test) ---
  // Scaled with the 0.8x cell size so each drag kick changes a cell's velocity by the same fraction
  // as before: mass scales with area (0.8^2), rotational inertia with mass x length^2 (0.8^4).
  // Unscaled, the kick over-corrects (reverses) a small cell's velocity and spin. Testbed value: 0.007.
  airResistance: 0.007 * 0.8 ** 2,
  angularAirResistance: 0.007 * 0.8 ** 4,
  // 1: a drag kick removes at most all of a cell's velocity / spin (it can stop a cell, never reverse
  // it). 0: the original kick, which for cells shorter than ~1.4 reverses the spin and multiplies
  // it by up to ~1.4 every growth step, so small cells without neighbours spin up until the physics
  // engine's speed limit and hit their neighbours like propellers (see NOTES.md).
  dragClamp: 1,

  // --- surface attachment near the walls ---
  anchorProbability: 0.0025, // per cell per growth event, when near a wall
  anchorFrequencyHz: 0.8,
  anchorDampingRatio: 0.3,
  // The testbed removed anchors after 200 s of *wall-clock* time. Here it is simulation
  // steps: 12000 = 200 s at 60 steps/s (the testbed's maximum, one step per frame).
  anchorLifetimeSteps: 12000,

  // --- cell shape and material ---
  radius: 0.4, // end-cap radius (half the cell width)
  density: 0.0001,
  restitution: 0.0,
  // friction: each cell gets U(0,1)

  // --- output ---
  snapshotInterval: 300, // steps between saved snapshots (must be a multiple of growthInterval)
};

export type SimulationParams = typeof DEFAULT_PARAMS & { seed: number };

export function checkParams(p: SimulationParams): void {
  // Snapshots are only checked on growth steps, so other values would silently skip snapshots
  if (!Number.isInteger(p.growthInterval) || p.growthInterval < 1) {
    throw new Error(`growthInterval must be a positive integer (got ${p.growthInterval})`);
  }
  if (!Number.isInteger(p.snapshotInterval) || p.snapshotInterval < 1 || p.snapshotInterval % p.growthInterval !== 0) {
    throw new Error(`snapshotInterval must be a positive multiple of growthInterval (${p.growthInterval}); got ${p.snapshotInterval}`);
  }
}

// ---------------------------------------------------------------- chamber geometry

export interface Point { x: number; y: number; }

/** A static triangle: a body at `offset` with these local vertices. */
export interface Triangle { offset: Point; vertices: [Point, Point, Point]; }

/** `count` rows, each placing every triangle in `vertexSets` at offset i * step (as the original test did). */
function triangleRows(count: number, step: Point, ...vertexSets: [Point, Point, Point][]): Triangle[] {
  const rows: Triangle[] = [];
  for (let i = 0; i < count; i++) {
    for (const vertices of vertexSets) { rows.push({ offset: { x: i * step.x, y: i * step.y }, vertices }); }
  }
  return rows;
}

const RIGHT_WALL_TRIANGLE: [Point, Point, Point] = [{ x: 50, y: 140 }, { x: 50, y: 142 }, { x: 49, y: 141 }];
const LEFT_WALL_TRIANGLE: [Point, Point, Point] = [{ x: -50, y: 140 }, { x: -50, y: 142 }, { x: -49, y: 141 }];
const TOP_WALL_TRIANGLE: [Point, Point, Point] = [{ x: -50, y: 200 }, { x: -48, y: 200 }, { x: -49, y: 199 }];

/**
 * Chamber walls, in the order the original test created them: rows of small triangles along the
 * walls, then the top wall and two side walls (open at the bottom).
 */
export const CHAMBER = {
  triangles: [
    ...triangleRows(12, { x: 0, y: 5 }, RIGHT_WALL_TRIANGLE, LEFT_WALL_TRIANGLE),
    ...triangleRows(20, { x: 5, y: 0 }, TOP_WALL_TRIANGLE),
  ],
  edges: [
    [{ x: -50, y: 200 }, { x: 50, y: 200 }],
    [{ x: 50, y: 200 }, { x: 50, y: 140 }],
    [{ x: -50, y: 200 }, { x: -50, y: 140 }],
  ] as [Point, Point][],
  /** Box2D's default fixture friction, which the walls used. */
  friction: 0.2,
};

// ---------------------------------------------------------------- cells

export interface RGB { r: number; g: number; b: number; }
export const COLOR_INITIAL: RGB = { r: 0.3, g: 0.35, b: 0.3 };
export const COLOR_WALL: RGB = { r: 0.1, g: 0.8, b: 0.18 };
export const COLOR_CENTRE: RGB = { r: 0.8, g: 0.1, b: 0.6 };

/**
 * The original Box2D cell is a box (2·radius × length) plus two full circles at the ends, and
 * applies drag once per fixture, i.e. three times per growth step.
 */
export const DRAG_APPLICATIONS_PER_CELL = 3;

/**
 * Fraction of a cell's velocity (or spin) removed by one drag kick: the testbed's force
 * (coefficient · velocity, once per fixture) acting for one time step, divided by the mass (or
 * rotational inertia). With `clamp` it is at most 1 (see dragClamp).
 */
export function dragFraction(coefficient: number, massOrInertia: number, dt: number, clamp: boolean): number {
  const fraction = DRAG_APPLICATIONS_PER_CELL * coefficient * dt / massOrInertia;
  return clamp && fraction > 1 ? 1 : fraction;
}

/**
 * Mass and rotational inertia of a newly created cell, exactly as Box2D computes them for the
 * box + two circles (the half-circles overlapping the box are counted twice, as in Box2D).
 * Box2D never recomputes them while the cell grows, so they stay fixed for the cell's life.
 */
export function cellMassProperties(length: number, radius: number, density: number): { mass: number, inertia: number } {
  const a = radius, b = length / 2;
  const boxMass = density * 4 * a * b;
  const capMass = density * Math.PI * a * a;
  const boxInertia = boxMass * ((2 * a) ** 2 + (2 * b) ** 2) / 12;
  const capInertia = capMass * (0.5 * a * a + b * b);
  return { mass: boxMass + 2 * capMass, inertia: boxInertia + 2 * capInertia };
}

/** Orientation as a fraction of π in [0, 1]. */
export function orientationOf(angle: number): number {
  return angle > 0 ? (angle / Math.PI) % 1 : 1 + (angle / Math.PI) % 1;
}

// ---------------------------------------------------------------- engine interface

/** What the runner and the viewer need from a simulation, whatever the physics engine. */
export interface Simulation {
  readonly engine: Engine;
  readonly params: SimulationParams;
  readonly states: StateRecorder;
  /** Number of simulation steps taken so far. */
  readonly stepCount: number;
  /** Number of bacteria currently in the world. */
  readonly cellCount: number;
  /** Advance one simulation step. Returns true if a snapshot was taken. */
  step(): boolean;
  /** Each cell's centre, angle, end-cap centre distance, colour and id, at full precision. */
  forEachCell(fn: (x: number, y: number, angle: number, length: number, color: RGB, id: number) => void): void;
  /** For drawing: each anchor point, with the centre of the cell it holds (if that cell still exists). */
  forEachAnchor(fn: (x: number, y: number, cell: Point | null) => void): void;
}
