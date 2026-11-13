/**
 * Microfluidic biofilm simulation on the Rapier physics engine (2D, WebAssembly).
 *
 * Same model as box2d-simulation.ts, step for step: growth, division, removal, drag, anchors and
 * snapshots happen at the same moments, with the same formulas, and draw random numbers in the
 * same order per cell. What differs is the contact physics itself (Rapier's solver) and a few
 * implementation choices listed in NOTES.md. Pure model: no browser or Node APIs.
 */

import RAPIER from "@dimforge/rapier2d-compat";
import type { Collider, ColliderDesc, ImpulseJoint, RigidBody, World } from "@dimforge/rapier2d-compat";
import {
  CHAMBER, COLOR_CENTRE, COLOR_INITIAL, COLOR_WALL, DEFAULT_PARAMS, Point, RGB,
  Simulation, SimulationParams, cellMassProperties, checkParams, dragFraction, orientationOf,
} from "./model.js";
import { Rng, mulberry32, randomSeed } from "./rng.js";
import { CellState, StateRecorder } from "./states.js";

let initialised: Promise<void> | null = null;

/** Load Rapier's WebAssembly (once). Must finish before a RapierSimulation is created. */
export function initRapier(): Promise<void> {
  if (!initialised) { initialised = RAPIER.init(); }
  return initialised;
}

interface Cell {
  id: number;
  body: RigidBody;
  collider: Collider;
  /** sqrt of the cell's friction coefficient (see createCell). */
  sqrtFriction: number;
  /** Mass and rotational inertia, fixed at birth. */
  mass: number;
  inertia: number;
  /** Distance between the end-cap centres (the exported `le`). */
  length: number;
  growthRate: number;
  reproductiveLength: number;
  color: RGB;
  /** Anchor springs currently holding this cell. */
  anchors: Anchor[];
  removed: boolean;
}

interface Anchor {
  body: RigidBody;
  x: number;
  y: number;
  createdAtStep: number;
  /** The cell it holds and the spring, until that cell divides or is removed. */
  cell: Cell | null;
  joint: ImpulseJoint | null;
}

/** Wall thickness. Walls are solid boxes rather than Box2D's zero-thickness edges (see NOTES.md). */
const WALL_THICKNESS = 2;

export class RapierSimulation implements Simulation {
  public readonly engine = "rapier";
  public readonly params: SimulationParams;
  public readonly world: World;
  public readonly states: StateRecorder = new StateRecorder();
  public stepCount: number = 0;

  private readonly rng: Rng;
  private nextId: number = 1;
  private cells: Cell[] = [];
  private anchors: Anchor[] = [];
  private readonly zero = { x: 0, y: 0 };

  constructor(overrides: Partial<SimulationParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, seed: randomSeed(), ...overrides };
    const p = this.params;
    checkParams(p);
    if (!Number.isInteger(p.rapierSubsteps) || p.rapierSubsteps < 1) {
      throw new Error(`rapierSubsteps must be a positive integer (got ${p.rapierSubsteps})`);
    }
    this.rng = mulberry32(p.seed);

    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = 1 / (p.hertz * p.rapierSubsteps);
    this.world.numSolverIterations = p.rapierSolverIterations;
    this.world.numInternalPgsIterations = p.rapierPgsIterations;
    if (p.rapierContactFrequency > 0) {
      this.world.integrationParameters.contact_natural_frequency = p.rapierContactFrequency;
    }

    for (let i = 0; i < p.initialCells; ++i) {
      const x = this.rng() * (p.maxX - p.minX) + p.minX;
      const y = this.rng() * (p.maxY - p.minY) + p.minY;
      const angle = this.rng() * 2 * Math.PI;
      const size = 0.2 * this.rng() * (p.maxSize - p.minSize) + p.minSize;
      this.cells.push(this.createCell(x, y, angle, size, COLOR_INITIAL, 0));
    }
    this.createWalls();
  }

  public get cellCount(): number {
    return this.cells.length;
  }

  public step(): boolean {
    const p = this.params;
    for (let i = 0; i < p.rapierSubsteps; i++) { this.world.step(); }
    this.stepCount += 1;

    if (this.stepCount % p.growthInterval !== 0) { return false; }

    this.growDivideAndMark();

    // Remove cells marked for removal (left the chamber, or died); divided cells were reused
    let kept = 0;
    for (const cell of this.cells) {
      if (cell.removed) {
        this.detachAnchors(cell, false); // removing the body removes its springs
        this.world.removeRigidBody(cell.body);
      } else {
        this.cells[kept++] = cell;
      }
    }
    this.cells.length = kept;

    // Remove expired anchors (removing the anchor body also removes its spring)
    kept = 0;
    for (const anchor of this.anchors) {
      if (this.stepCount - anchor.createdAtStep >= p.anchorLifetimeSteps) {
        if (anchor.cell) { anchor.cell.anchors.splice(anchor.cell.anchors.indexOf(anchor), 1); }
        this.world.removeRigidBody(anchor.body);
      } else {
        this.anchors[kept++] = anchor;
      }
    }
    this.anchors.length = kept;

    if (this.stepCount % p.snapshotInterval === 0) {
      this.takeSnapshot();
      return true;
    }
    return false;
  }

  public forEachCell(fn: (x: number, y: number, angle: number, length: number, color: RGB, id: number) => void): void {
    for (const cell of this.cells) {
      const t = cell.body.translation();
      fn(t.x, t.y, cell.body.rotation(), cell.length, cell.color, cell.id);
    }
  }

  public forEachAnchor(fn: (x: number, y: number, cell: Point | null) => void): void {
    for (const anchor of this.anchors) {
      fn(anchor.x, anchor.y, anchor.cell ? anchor.cell.body.translation() : null);
    }
  }

  private growDivideAndMark(): void {
    const p = this.params;
    const dt = 1 / p.hertz;
    const count = this.cells.length; // daughters appended below are first visited on the next growth step
    for (let i = 0; i < count; i++) {
      const cell = this.cells[i];
      const body = cell.body;

      // Grow along the long axis
      cell.length *= cell.growthRate;
      this.resizeCollider(cell);

      // Drag. Box2D applied the force once per fixture (3x), and it acted during the next step;
      // the same velocity change as an impulse now.
      const v = body.linvel();
      const linear = -dragFraction(p.airResistance, cell.mass, dt, p.dragClamp !== 0) * cell.mass;
      body.applyImpulse({ x: linear * v.x, y: linear * v.y }, true);
      body.applyTorqueImpulse(-dragFraction(p.angularAirResistance, cell.inertia, dt, p.dragClamp !== 0) * cell.inertia * body.angvel(), true);

      const length = cell.length;
      const position = body.translation();
      const angle = body.rotation();
      let divided = false;

      // Divide into two daughters along the long axis
      if (length >= cell.reproductiveLength) {
        const a = p.radius;
        const proportion = p.reproductionProportionMin + this.rng() * p.reproductionProportionRange;
        const lengthA = (length - (2 * a)) * proportion;
        const lengthB = (length - (2 * a)) * (1 - proportion);
        // Distances of the daughters' centres from the parent's (see centredDivision in model.ts)
        const factorA = p.centredDivision ? length / 2 - lengthB / 2 : proportion * (1 / 2) * length + (a / 2);
        const factorB = p.centredDivision ? length / 2 - lengthA / 2 : (1 - proportion) * (1 / 2) * length + (a / 2);
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const x1 = position.x + factorB * sin, y1 = position.y - factorB * cos;
        const x2 = position.x - factorA * sin, y2 = position.y + factorA * cos;

        // Daughter 1 reuses the parent's body and collider (new id, fresh state); daughter 2 is new
        const color = cell.color;
        const parentId = cell.id;
        this.detachAnchors(cell, true);
        this.resetCell(cell, x1, y1, angle, lengthA, color, parentId);
        this.cells.push(this.createCell(x2, y2, angle, lengthB, color, parentId));
        divided = true;
      }

      // Leave the chamber, or die at random (draws the death number only when inside, as Box2D did)
      if (position.x < p.minX || position.x > p.maxX || position.y < p.minY || position.y > p.maxY || this.rng() < p.randomDeathProbability) {
        // A divided parent no longer exists (its daughters stay, as in Box2D)
        if (!divided) { cell.removed = true; }
      }

      // Near the side walls: different growth rate, and a chance to attach to the surface
      if (position.x < p.minX + p.wallZone || position.x > p.maxX - p.wallZone) {
        if (!divided) {
          cell.color = COLOR_WALL;
          cell.growthRate = 1 + p.wallRate;
        }
        if (this.rng() < p.anchorProbability) {
          // In Box2D a cell that divided in this same pass still got the anchor, whose spring then
          // vanished with the parent: an anchor point holding nothing. Same here.
          this.createAnchor(position.x, position.y, divided || cell.removed ? null : cell);
        }
      } else if (!divided) {
        cell.color = COLOR_CENTRE;
        cell.growthRate = 1 + p.rate;
      }
    }
  }

  private takeSnapshot(): void {
    const cells: CellState[] = [];
    for (const cell of this.cells) {
      const t = cell.body.translation();
      cells.push({ x: t.x, y: t.y, id: cell.id, an: orientationOf(cell.body.rotation()), le: cell.length });
    }
    this.states.addSnapshot(cells);
  }

  /** A new cell. Random numbers are drawn in Box2D's order: friction, then division length. */
  private createCell(x: number, y: number, angle: number, length: number, color: RGB, parentId: number): Cell {
    const p = this.params;
    const friction = this.rng();
    const reproductiveLength = p.reproductiveLengthMean + (this.rng() - 0.5) * p.reproductiveLengthSpread;
    const { mass, inertia } = cellMassProperties(length, p.radius, p.density);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setRotation(angle)
      .setCanSleep(false)
      .setAdditionalMassProperties(mass, this.zero, inertia));
    // Box2D mixes frictions as sqrt(f1 * f2): store sqrt(f) and multiply
    const sqrtFriction = Math.sqrt(friction);
    const collider = this.world.createCollider(this.cellColliderDesc(length, sqrtFriction), body);
    const id = this.nextId++;
    this.states.addLineage(id, parentId);
    return {
      id, body, collider, sqrtFriction, mass, inertia, length, color, reproductiveLength,
      growthRate: 1 + p.rate, anchors: [], removed: false,
    };
  }

  private cellColliderDesc(length: number, sqrtFriction: number): ColliderDesc {
    const p = this.params;
    // Mass comes from the body (fixed at birth, as in Box2D), so the collider has no density
    return RAPIER.ColliderDesc.capsule(length / 2, p.radius)
      .setDensity(0)
      .setFriction(sqrtFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
      .setRestitution(p.restitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);
  }

  /**
   * Give the cell's collider its current length.
   *
   * Rapier (0.21) keeps a contact's points from step to step as long as the two bodies hardly move
   * relative to each other, and does not recompute them when a collider's shape changes
   * (setHalfHeight / setShape). A cell at rest, e.g. in a packed colony, then grows straight into
   * its neighbours and the walls with the contact still reporting zero depth. Replacing the
   * collider forces fresh contacts. rapierRefreshContacts = 0 resizes in place instead (to show the
   * effect; see NOTES.md).
   */
  private resizeCollider(cell: Cell): void {
    if (this.params.rapierRefreshContacts) {
      this.world.removeCollider(cell.collider, false);
      cell.collider = this.world.createCollider(this.cellColliderDesc(cell.length, cell.sqrtFriction), cell.body);
    } else {
      cell.collider.setHalfHeight(cell.length / 2);
    }
  }

  /** Turn an existing cell (a dividing parent) into a newborn one: same as createCell, reusing the body. */
  private resetCell(cell: Cell, x: number, y: number, angle: number, length: number, color: RGB, parentId: number): void {
    const p = this.params;
    const friction = this.rng();
    cell.reproductiveLength = p.reproductiveLengthMean + (this.rng() - 0.5) * p.reproductiveLengthSpread;
    const { mass, inertia } = cellMassProperties(length, p.radius, p.density);
    const body = cell.body;
    body.setTranslation({ x, y }, true);
    body.setRotation(angle, true);
    body.setLinvel(this.zero, true);
    body.setAngvel(0, true);
    body.setAdditionalMassProperties(mass, this.zero, inertia, true);
    cell.mass = mass;
    cell.inertia = inertia;
    cell.length = length;
    cell.sqrtFriction = Math.sqrt(friction);
    this.world.removeCollider(cell.collider, false); // new shape and friction, fresh contacts
    cell.collider = this.world.createCollider(this.cellColliderDesc(length, cell.sqrtFriction), body);
    cell.color = color;
    cell.growthRate = 1 + p.rate;
    cell.id = this.nextId++;
    this.states.addLineage(cell.id, parentId);
  }

  /** Zero-length spring from the cell centre to a new fixed point (none if `cell` is null). */
  private createAnchor(x: number, y: number, cell: Cell | null): void {
    const p = this.params;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
    const anchor: Anchor = { body, x, y, createdAtStep: this.stepCount, cell, joint: null };
    if (cell) {
      // Box2D's LinearStiffness for a cell held by a static body: stiffness m·ω², damping 2·m·ζ·ω
      const mass = cell.body.mass();
      const omega = 2 * Math.PI * p.anchorFrequencyHz;
      const data = RAPIER.JointData.spring(0, mass * omega * omega, 2 * mass * p.anchorDampingRatio * omega, this.zero, this.zero);
      anchor.joint = this.world.createImpulseJoint(data, cell.body, body, true);
      cell.anchors.push(anchor);
    }
    this.anchors.push(anchor);
  }

  /** The cell's anchors stop holding it. `removeJoints`: false when the cell's body is about to be removed anyway. */
  private detachAnchors(cell: Cell, removeJoints: boolean): void {
    for (const anchor of cell.anchors) {
      if (removeJoints && anchor.joint) { this.world.removeImpulseJoint(anchor.joint, true); }
      anchor.joint = null;
      anchor.cell = null;
    }
    cell.anchors.length = 0;
  }

  /**
   * Chamber walls as one fixed body. Side and top walls are solid boxes whose inner faces lie on
   * Box2D's edges; the small triangles are the same as in Box2D.
   */
  private createWalls(): void {
    const walls = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const add = (desc: ColliderDesc) => this.world.createCollider(desc
      .setFriction(Math.sqrt(CHAMBER.friction))
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max), walls);
    for (const [v1, v2] of CHAMBER.edges) {
      // Axis-aligned edges; the box extends away from the chamber centre
      const cx = (v1.x + v2.x) / 2, cy = (v1.y + v2.y) / 2;
      const hx = Math.abs(v1.x - v2.x) / 2, hy = Math.abs(v1.y - v2.y) / 2;
      const t = WALL_THICKNESS / 2;
      if (hx === 0) {
        add(RAPIER.ColliderDesc.cuboid(t, hy).setTranslation(cx + Math.sign(cx) * t, cy));
      } else {
        add(RAPIER.ColliderDesc.cuboid(hx + 2 * t, t).setTranslation(cx, cy + t)); // top wall, covering the corners
      }
    }
    for (const tri of CHAMBER.triangles) {
      const [a, b, c] = tri.vertices.map((v) => ({ x: v.x + tri.offset.x, y: v.y + tri.offset.y }));
      // Rapier needs counter-clockwise triangles: a clockwise one lets cells pass through it (the
      // left- and top-wall triangles are listed clockwise; Box2D reorders them itself)
      const clockwise = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y) < 0;
      add(clockwise ? RAPIER.ColliderDesc.triangle(a, c, b) : RAPIER.ColliderDesc.triangle(a, b, c));
    }
  }
}
