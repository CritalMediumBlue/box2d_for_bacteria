/**
 * Microfluidic biofilm simulation: rod-shaped bacteria growing and dividing in a chamber.
 *
 * Pure model: no browser or Node APIs, so the same code runs in the viewer (viewer.ts)
 * and in the command-line runner (run.ts).
 */

import * as b2 from "../../build/esm/index.js";
import { Rng, mulberry32, randomSeed } from "./rng.js";
import { CellState, StateRecorder } from "./states.js";

/** All tunable parameters. Override any of them via the constructor (or `--set` in run.js). */
export const DEFAULT_PARAMS = {
  // --- physics stepping (same values the testbed used) ---
  hertz: 60, // time step = 1 / hertz
  velocityIterations: 20,
  positionIterations: 20,
  particleIterations: 10,

  // --- chamber ---
  minX: -50, maxX: 50, // cells leaving this range are removed
  minY: 140, maxY: 200,

  // --- initial population ---
  initialCells: 1000,
  minSize: 3, maxSize: 6, // initial length = minSize + 0.2 * U(0,1) * (maxSize - minSize)

  // --- growth and division (applied every growthInterval steps) ---
  growthInterval: 25,
  rate: 0.002 * 0.8, // per growth event: length *= 1 + rate
  wallRate: 0.002 * 0.8, // growth rate near the side walls
  wallZone: 20, // "near the wall" = within this distance of minX / maxX
  reproductionProportionMin: 0.3, // daughter 1 gets min + U(0,1) * range of the parent
  reproductionProportionRange: 0.2,
  reproductiveLengthMean: 6, // division length = mean + (U(0,1) - 0.5) * spread
  reproductiveLengthSpread: 2.5,
  randomDeathProbability: 0.001 * 0.15, // per cell per growth event

  // --- drag (applied on growth steps only, once per fixture, as in the original test) ---
  airResistance: 0.007,
  angularAirResistance: 0.007,

  // --- surface attachment near the walls ---
  anchorProbability: 0.0025, // per cell per growth event, when near a wall
  anchorFrequencyHz: 0.8,
  anchorDampingRatio: 0.3,
  // The testbed removed anchors after 200 s of *wall-clock* time. Here it is simulation
  // steps: 12000 = 200 s at 60 steps/s (the testbed's maximum, one step per frame).
  anchorLifetimeSteps: 12000,

  // --- cell shape and material ---
  radius: 0.5, // end-cap radius (half the cell width)
  density: 0.0001,
  restitution: 0.0,
  // friction: each cell gets U(0,1)

  // --- output ---
  snapshotInterval: 300, // steps between saved snapshots (must be a multiple of growthInterval)
};

export type SimulationParams = typeof DEFAULT_PARAMS & { seed: number };

const COLOR_INITIAL = new b2.Color(0.3, 0.35, 0.3);
const COLOR_WALL = new b2.Color(0.1, 0.8, 0.18);
const COLOR_CENTRE = new b2.Color(0.8, 0.1, 0.6);

/** Extra per-body state attached to each bacterium. */
interface Bacterium extends b2.Body {
  growthRate: number;
  reproductiveLength: number;
  id: number;
  destroy?: boolean;
}

/** Orientation as a fraction of π in [0, 1]. */
function orientationOf(angle: number): number {
  return angle > 0 ? (angle / Math.PI) % 1 : 1 + (angle / Math.PI) % 1;
}

/** End-cap circle centres (local coordinates). */
function capCentres(body: b2.Body): b2.Vec2[] {
  const centres: b2.Vec2[] = [];
  for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
    const shape = fixture.GetShape();
    if (shape.GetType() === b2.ShapeType.e_circleShape) {
      centres.push((shape as b2.CircleShape).m_p);
    }
  }
  return centres;
}

export class BiofilmSimulation {
  public readonly params: SimulationParams;
  public readonly world: b2.World;
  public readonly states: StateRecorder = new StateRecorder();
  /** Number of simulation steps taken so far. */
  public stepCount: number = 0;

  private readonly rng: Rng;
  private nextId: number = 1;

  constructor(overrides: Partial<SimulationParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, seed: randomSeed(), ...overrides };
    const p = this.params;
    // Snapshots are only checked on growth steps, so other values would silently skip snapshots
    if (!Number.isInteger(p.growthInterval) || p.growthInterval < 1) {
      throw new Error(`growthInterval must be a positive integer (got ${p.growthInterval})`);
    }
    if (!Number.isInteger(p.snapshotInterval) || p.snapshotInterval < 1 || p.snapshotInterval % p.growthInterval !== 0) {
      throw new Error(`snapshotInterval must be a positive multiple of growthInterval (${p.growthInterval}); got ${p.snapshotInterval}`);
    }
    this.rng = mulberry32(p.seed);

    this.world = new b2.World(new b2.Vec2(0, 0));
    this.world.SetAllowSleeping(false);
    this.world.SetWarmStarting(true);
    this.world.SetContinuousPhysics(false);
    this.world.SetSubStepping(false);

    for (let i = 0; i < p.initialCells; ++i) {
      const x = this.rng() * (p.maxX - p.minX) + p.minX;
      const y = this.rng() * (p.maxY - p.minY) + p.minY;
      const angle = this.rng() * 2 * Math.PI;
      const size = 0.2 * this.rng() * (p.maxSize - p.minSize) + p.minSize;
      this.createBacterium(new b2.Vec2(x, y), angle, size, COLOR_INITIAL, 0);
    }

    // Rows of small triangles along the walls
    this.createTrianglesY(12, [new b2.Vec2(50, 140), new b2.Vec2(50, 142), new b2.Vec2(49, 141)], [new b2.Vec2(-50, 140), new b2.Vec2(-50, 142), new b2.Vec2(-49, 141)]);
    this.createTrianglesX(20, [new b2.Vec2(-50, 200), new b2.Vec2(-48, 200), new b2.Vec2(-49, 199)]);

    // Container: top wall and two side walls (open at the bottom)
    this.createEdge(new b2.Vec2(-50, 200), new b2.Vec2(50, 200));
    this.createEdge(new b2.Vec2(50, 200), new b2.Vec2(50, 140));
    this.createEdge(new b2.Vec2(-50, 200), new b2.Vec2(-50, 140));
  }

  /** Number of bacteria currently in the world. */
  public get cellCount(): number {
    let n = 0;
    for (let b = this.world.GetBodyList(); b; b = b.GetNext()) {
      if (b.GetType() === b2.BodyType.b2_dynamicBody) { n++; }
    }
    return n;
  }

  /** Advance one simulation step. Returns true if a snapshot was taken. */
  public step(): boolean {
    const p = this.params;
    this.world.Step(1 / p.hertz, p.velocityIterations, p.positionIterations, p.particleIterations);
    this.stepCount += 1;

    if (this.stepCount % p.growthInterval !== 0) { return false; }

    this.growDivideAndMark();

    // Remove cells marked for destruction (divided, left the chamber, or died)
    for (let b = this.world.GetBodyList(); b; b = b.GetNext()) {
      if ((b as Bacterium).destroy) {
        this.world.DestroyBody(b);
      }
    }

    // Remove expired anchors (destroying the anchor body also removes its joint)
    for (let b = this.world.GetBodyList(); b; b = b.GetNext()) {
      const userData = b.GetUserData();
      if (userData && this.stepCount - userData.anchorCreatedAtStep >= p.anchorLifetimeSteps) {
        this.world.DestroyBody(b);
      }
    }

    if (this.stepCount % p.snapshotInterval === 0) {
      this.takeSnapshot();
      return true;
    }
    return false;
  }

  private growDivideAndMark(): void {
    const p = this.params;
    for (let b = this.world.GetBodyList(); b; b = b.GetNext()) {
      if (b.GetType() !== b2.BodyType.b2_dynamicBody) { continue; }
      const body = b as Bacterium;

      // Grow along the long axis, and apply drag (once per fixture, as in the original)
      for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
        const shape = fixture.GetShape();
        if (shape.GetType() === b2.ShapeType.e_polygonShape) {
          (shape as b2.PolygonShape).m_vertices.forEach((vertex) => vertex.y *= body.growthRate);
        } else if (shape.GetType() === b2.ShapeType.e_circleShape) {
          (shape as b2.CircleShape).m_p.y *= body.growthRate;
        }
        const velocity = body.GetLinearVelocity();
        body.ApplyForce(new b2.Vec2(-p.airResistance * velocity.x, -p.airResistance * velocity.y), body.GetWorldCenter(), true);
        body.ApplyTorque(-p.angularAirResistance * body.GetAngularVelocity(), true);
      }

      const [c1, c2] = capCentres(body);
      const length = b2.Vec2.DistanceVV(c1, c2);
      const position = body.GetPosition();
      const angle = body.GetAngle();

      // Divide into two daughters along the long axis
      if (length >= body.reproductiveLength) {
        const a = p.radius;
        const proportion = p.reproductionProportionMin + this.rng() * p.reproductionProportionRange;
        const factorA = proportion * (1 / 2) * length + (a / 2);
        const factorB = (1 - proportion) * (1 / 2) * length + (a / 2);
        const lengthA = (length - (2 * a)) * proportion;
        const lengthB = (length - (2 * a)) * (1 - proportion);
        const offsetA = new b2.Vec2(-factorA * Math.sin(angle), factorA * Math.cos(angle));
        const offsetB = new b2.Vec2(-factorB * Math.sin(angle), factorB * Math.cos(angle));
        const position1 = new b2.Vec2(position.x - offsetB.x, position.y - offsetB.y);
        const position2 = new b2.Vec2(position.x + offsetA.x, position.y + offsetA.y);

        this.createBacterium(position1, angle, lengthA, body.myCustomColor!, body.id);
        this.createBacterium(position2, angle, lengthB, body.myCustomColor!, body.id);
        body.destroy = true;
      }

      // Leave the chamber, or die at random
      if (position.x < p.minX || position.x > p.maxX || position.y < p.minY || position.y > p.maxY || this.rng() < p.randomDeathProbability) {
        body.destroy = true;
      }

      // Near the side walls: different growth rate, and a chance to attach to the surface
      if (position.x < p.minX + p.wallZone || position.x > p.maxX - p.wallZone) {
        body.myCustomColor = COLOR_WALL;
        body.growthRate = 1 + p.wallRate;
        if (this.rng() < p.anchorProbability) {
          this.createAnchor(body);
        }
      } else {
        body.myCustomColor = COLOR_CENTRE;
        body.growthRate = 1 + p.rate;
      }
    }
  }

  private takeSnapshot(): void {
    const cells: CellState[] = [];
    for (let b = this.world.GetBodyList(); b; b = b.GetNext()) {
      if (b.GetType() !== b2.BodyType.b2_dynamicBody) { continue; }
      const body = b as Bacterium;
      const [c1, c2] = capCentres(body);
      const position = body.GetPosition();
      cells.push({
        x: position.x,
        y: position.y,
        id: body.id,
        an: orientationOf(body.GetAngle()),
        le: b2.Vec2.DistanceVV(c1, c2),
      });
    }
    this.states.addSnapshot(cells);
  }

  private createBacterium(position: b2.XY, angle: number, length: number, color: b2.Color, parentId: number): Bacterium {
    const p = this.params;
    const friction = this.rng();
    const bd = new b2.BodyDef();
    bd.type = b2.BodyType.b2_dynamicBody;
    bd.position.Set(position.x, position.y);
    bd.angle = angle;
    const body = this.world.CreateBody(bd) as Bacterium;
    const a = p.radius;
    const b = length / 2;
    body.CreateFixture({ shape: new b2.PolygonShape().SetAsBox(a, b), density: p.density, restitution: p.restitution, friction });
    const circleShape = new b2.CircleShape(a);
    const circleFixtureDef = { shape: circleShape, density: p.density, restitution: p.restitution, friction };
    for (const dy of [-b, b]) {
      circleShape.m_p.Set(0, dy);
      body.CreateFixture(circleFixtureDef);
    }
    body.growthRate = 1 + p.rate;
    body.reproductiveLength = p.reproductiveLengthMean + (this.rng() - 0.5) * p.reproductiveLengthSpread;
    body.myCustomColor = color;
    body.id = this.nextId++;
    this.states.addLineage(body.id, parentId);
    return body;
  }

  /** Attach a cell to the surface: a zero-length spring to a new static body at its centre. */
  private createAnchor(body: b2.Body): void {
    const p = this.params;
    const groundDef = new b2.BodyDef();
    groundDef.position.Set(body.GetPosition().x, body.GetPosition().y);
    const ground = this.world.CreateBody(groundDef);

    const jd = new b2.DistanceJointDef();
    jd.bodyA = body;
    jd.bodyB = ground;
    jd.localAnchorA.Set(0, 0);
    jd.localAnchorB.Set(0, 0);
    b2.LinearStiffness(jd, p.anchorFrequencyHz, p.anchorDampingRatio, jd.bodyA, jd.bodyB);
    jd.length = 0;
    jd.collideConnected = false;
    this.world.CreateJoint(jd);
    ground.SetUserData({ anchorCreatedAtStep: this.stepCount });
  }

  private createEdge(v1: b2.Vec2, v2: b2.Vec2): void {
    const body = this.world.CreateBody(new b2.BodyDef());
    const edge = new b2.EdgeShape();
    edge.SetTwoSided(v1, v2);
    body.CreateFixture(edge, 0);
  }

  private createTriangle(x: number, y: number, vertices: b2.Vec2[]): void {
    const bd = new b2.BodyDef();
    bd.position.Set(x, y);
    const body = this.world.CreateBody(bd);
    const shape = new b2.PolygonShape();
    shape.Set(vertices, 3);
    body.CreateFixture(shape, 0);
  }

  private createTrianglesX(count: number, ...triangles: b2.Vec2[][]): void {
    for (let i = 0; i < count; i++) {
      triangles.forEach((t) => this.createTriangle(i * 5, 0, t));
    }
  }

  private createTrianglesY(count: number, ...triangles: b2.Vec2[][]): void {
    for (let i = 0; i < count; i++) {
      triangles.forEach((t) => this.createTriangle(0, i * 5, t));
    }
  }
}
