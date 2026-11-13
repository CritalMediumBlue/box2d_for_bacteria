// MIT License

import * as b2 from "@box2d";
import * as testbed from "@testbed";

const MIN_X = -50, MAX_X = 50; // X range
const MIN_Y = 140, MAX_Y = 200; // Y range
const MIN_SIZE = 3, MAX_SIZE = 6; // Size range of the initial bacteria
const COLOR = new b2.Color(0.3, 0.35, 0.3); // Color
const REPRODUCTION_PROPORTION_MIN = 0.3; // Minimum proportion of the parent's length for the child
const REPRODUCTION_PROPORTION_MAX = 0.2; // 0.3 + 0.2 = 0.5 maximum proportion of the parent's length for the child
const RANDOM_THRESHOLD = 0.001 * 0.15;
const JOINT_CREATION_THRESHOLD = 0.0025;
const RATE = 0.002 * 0.8;
const GROWTH_RATE = 1 + RATE;
const MODIFIED_GROWTH_RATE = 1 + (RATE * 1);
const TIME_STEP_INTERVAL = 150;
const AIR_RESISTANCE = 0.007;
const ANGULAR_AIR_RESISTANCE = 0.007;

// State export (same format as LowRes.json): press "j" to save; auto-saves periodically.
const SNAPSHOT_INTERVAL = 150; // simulation steps between snapshots (must be a multiple of 25)
const AUTO_SAVE_EVERY_SNAPSHOTS = 500; // auto-save after this many snapshots
const STATES_FILE_NAME = "states.json";

/** Extra per-body state attached to each bacterium. */
interface Bacterium extends b2.Body {
  growthRate: number;
  reproductiveLength: number;
  id: number; // sequential, never reused; parent recorded in lineage
  userData?: { destroy?: boolean };
}

interface BodyParams {
  x: number;
  y: number;
  angle: number;
  length: number;
  id: number;
  time: number;
}

/** Round to 2 decimals (the LowRes coarse graining). */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Orientation as a fraction of π in [0, 1]. */
function orientationOf(angle: number): number {
  return angle > 0 ? (angle / Math.PI) % 1 : 1 + (angle / Math.PI) % 1;
}

/** Distance between the centres of the two end-cap circles. */
function lengthOf(body: b2.Body): number {
  const centres: b2.Vec2[] = [];
  for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
    const shape = fixture.GetShape();
    if (shape.GetType() === b2.ShapeType.e_circleShape) {
      centres.push((shape as b2.CircleShape).m_p);
    }
  }
  return centres.length >= 2 ? b2.Vec2.DistanceVV(centres[0], centres[1]) : 0;
}

/** Minimal typing for the File System Access API (Chrome/Edge). */
interface WritableFileHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>, close(): Promise<void> }>;
}

export class MicrofluidicBiofilm extends testbed.Test {
  public dynamicBodyCount: number = 0;
  public time_step: number = 0;
  public data: unknown[] = [];
  public bodies_params: BodyParams[] = [];

  // State export
  private nextId: number = 1;
  private lineage: number[] = []; // lineage[childId] = parentId (0 for the initial cells)
  private snapshotParts: string[] = []; // one serialized `"n":[...]` entry per snapshot
  private saveHandle: WritableFileHandle | null = null;
  private saving: boolean = false;

  constructor() {
    super();
    this.m_world.SetGravity(new b2.Vec2(0, 0));

    this.dynamicBodyCount = 0;

    for (let i = 1; i <= 1000; ++i) {
      // Generate a random position within the defined area
      const x = Math.random() * (MAX_X - MIN_X) + MIN_X;
      const y = Math.random() * (MAX_Y - MIN_Y) + MIN_Y;

      // Generate a random angle between 0 and 2π
      const angle = Math.random() * 2 * Math.PI;

      // Generate a random size within the defined range
      const size = 0.2 * Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE;

      this.createBacteria(this.m_world, new b2.Vec2(x, y), angle, size, COLOR, 0);
      this.dynamicBodyCount++;
    }

    this.time_step = 0;
    this.data = [];
    this.bodies_params = [];

    // Create triangles
    this.createTrianglesy(12, [new b2.Vec2(50, 140), new b2.Vec2(50, 142), new b2.Vec2(49, 141)], [new b2.Vec2(-50, 140), new b2.Vec2(-50, 142), new b2.Vec2(-49, 141)]);
    this.createTrianglesx(20, [new b2.Vec2(-50, 200), new b2.Vec2(-48, 200), new b2.Vec2(-49, 199)]);

    // Create the container
    this.createContainer([new b2.Vec2(-50, 200), new b2.Vec2(50, 200)], [new b2.Vec2(50, 200), new b2.Vec2(50, 140)], [new b2.Vec2(-50, 200), new b2.Vec2(-50, 140)]);
  }

  public override Step(settings: testbed.Settings): void {
    super.Step(settings);
    if (!settings.m_pause) {

      this.time_step += 1;

      if (this.time_step % 25 === 0) {

        for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
          if (b.GetType() === b2.BodyType.b2_dynamicBody) {
            const body = b as Bacterium;

            const circlePositions: b2.Vec2[] = [];
            for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
              const shape = fixture.GetShape();
              const isPolygon = shape.GetType() === b2.ShapeType.e_polygonShape;
              const isCircle = shape.GetType() === b2.ShapeType.e_circleShape;

              if (isPolygon) {
                (shape as b2.PolygonShape).m_vertices.forEach((vertex) => vertex.y *= body.growthRate);
              } else if (isCircle) {
                (shape as b2.CircleShape).m_p.y *= body.growthRate;
                circlePositions.push((shape as b2.CircleShape).m_p);
              }
              // Calculate the air resistance force
              const velocity = body.GetLinearVelocity();
              const airResistanceForce = new b2.Vec2(-AIR_RESISTANCE * velocity.x, -AIR_RESISTANCE * velocity.y);

              // Apply the air resistance force to the body
              body.ApplyForce(airResistanceForce, body.GetWorldCenter(), true);

              // Calculate the air resistance torque
              const angularVelocity = body.GetAngularVelocity();
              const airResistanceTorque = -ANGULAR_AIR_RESISTANCE * angularVelocity;

              // Apply the air resistance torque to the body
              body.ApplyTorque(airResistanceTorque, true);
            }
            // Destructure circlePositions for readability
            const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = circlePositions;

            // Calculate difference vector
            const diff = new b2.Vec2(x1 - x2, y1 - y2);
            const length = diff.Length();

            // Get original position and angle
            const originalPosition = body.GetPosition();
            const originalAngle = body.GetAngle();

            if (length >= body.reproductiveLength) {
              const a = 0.5; // Explain what 'a' represents
              const proportion = REPRODUCTION_PROPORTION_MIN + Math.random() * REPRODUCTION_PROPORTION_MAX;

              // Group related calculations into helper functions
              const factorA = this.calculateFactor(proportion, length, a);
              const factorB = this.calculateFactor(1 - proportion, length, a);
              const factor2A = this.calculateFactor2(length, a, proportion);
              const factor2B = this.calculateFactor2(length, a, 1 - proportion);
              const offsetA = this.calculateOffset(factorA, originalAngle);
              const offsetB = this.calculateOffset(factorB, originalAngle);

              // Calculate new positions
              const newPosition1 = new b2.Vec2(originalPosition.x - offsetB.x, originalPosition.y - offsetB.y);
              const newPosition2 = new b2.Vec2(originalPosition.x + offsetA.x, originalPosition.y + offsetA.y);

              // Create new bacteria (they get new sequential ids, with this body as parent)
              this.createBacteria(this.m_world, newPosition1, originalAngle, factor2A, body.myCustomColor!, body.id);
              this.createBacteria(this.m_world, newPosition2, originalAngle, factor2B, body.myCustomColor!, body.id);
              this.dynamicBodyCount += 2;

              // Mark body for destruction
              body.userData = { destroy: true };
            }

            if (originalPosition.x < MIN_X || originalPosition.x > MAX_X || originalPosition.y < MIN_Y || originalPosition.y > MAX_Y || Math.random() < RANDOM_THRESHOLD) {
              body.userData = { destroy: true };
            }

            const Close_to_walls = (originalPosition.x < MIN_X + 20 || originalPosition.x > MAX_X - 20);
            if (Close_to_walls) {
              body.myCustomColor = new b2.Color(0.1, 0.8, 0.18);
              body.growthRate = MODIFIED_GROWTH_RATE;
              if (Math.random() < JOINT_CREATION_THRESHOLD) {
                this.createStaticJoints(this.m_world, body);
              }
            } else {
              body.myCustomColor = new b2.Color(0.8, 0.1, 0.6);
              body.growthRate = GROWTH_RATE;
            }

            if (this.time_step % TIME_STEP_INTERVAL === 0) {
              let orientation;
              if (originalAngle > 0) {
                orientation = (originalAngle / Math.PI) % 1;
              } else {
                orientation = 1 + (originalAngle / Math.PI) % 1;
              }
              if (!body.userData) {
                body.userData = {};
              }

              this.bodies_params.push({
                x: originalPosition.x,
                y: originalPosition.y,
                angle: orientation,
                length: length,
                id: body.id,
                time: this.time_step / TIME_STEP_INTERVAL,
              });
            }
          }
        }

        // Destroy bodies marked for destruction
        for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
          const body = b as Bacterium;
          if (body.userData && body.userData.destroy) {
            this.m_world.DestroyBody(body);
            this.dynamicBodyCount--;
          }
        }

        const JOINT_LIFETIME_MS = 200000; // 1 second

        for (let joint = this.m_world.GetJointList(); joint; joint = joint.GetNext()) {
          if (Date.now() - (joint as any).creationTime >= JOINT_LIFETIME_MS) {
            this.m_world.DestroyJoint(joint);
          }
        }

        const BODY_LIFETIME_MS = 200000;

        for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
          const userData = body.GetUserData();
          if (userData && Date.now() - userData.creationTime >= BODY_LIFETIME_MS) {
            this.m_world.DestroyBody(body);
          }
        }

        // Snapshot after divisions and removals, so it shows the population as it is now
        if (this.time_step % SNAPSHOT_INTERVAL === 0) {
          this.takeSnapshot();
          if (this.snapshotParts.length % AUTO_SAVE_EVERY_SNAPSHOTS === 0) {
            void this.saveStates(true);
          }
        }
      }
    }
  }

  /** Record x, y, id, an, le (2 decimals) for every bacterium currently alive. */
  private takeSnapshot(): void {
    const alive: Bacterium[] = [];
    for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
      if (b.GetType() !== b2.BodyType.b2_dynamicBody) { continue; }
      const body = b as Bacterium;
      if (body.userData && body.userData.destroy) { continue; }
      alive.push(body);
    }
    alive.sort((a, b) => a.id - b.id); // ascending id, as in LowRes.json
    const cells = alive.map((body) => {
      const p = body.GetPosition();
      return JSON.stringify({
        x: round2(p.x),
        y: round2(p.y),
        id: body.id,
        an: round2(orientationOf(body.GetAngle())),
        le: round2(lengthOf(body)),
      });
    });
    const n = this.snapshotParts.length + 1;
    this.snapshotParts.push(`"${n}":[${cells.join(",")}]`);
  }

  /** Assemble the LowRes-format file from the stored pieces (no single giant string). */
  private buildStatesBlob(): Blob {
    const parts: string[] = ["{"];
    this.snapshotParts.forEach((part, i) => {
      if (i > 0) { parts.push(","); }
      parts.push(part);
    });
    const lineageEntries: string[] = [];
    for (let id = 1; id < this.nextId; id++) {
      lineageEntries.push(`"${id}":${this.lineage[id]}`);
    }
    parts.push(this.snapshotParts.length > 0 ? "," : "", `"lineage":{${lineageEntries.join(",")}}}`);
    return new Blob(parts, { type: "application/json" });
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /**
   * Save all snapshots so far. With a file chosen via "j" (Chrome/Edge), that file is
   * overwritten; otherwise a copy is downloaded (numbered when auto-saving).
   */
  private async saveStates(auto: boolean): Promise<void> {
    if (this.saving) { return; } // previous save still running
    this.saving = true;
    try {
      const blob = this.buildStatesBlob();
      if (this.saveHandle) {
        const writable = await this.saveHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const name = auto ? `states_${this.snapshotParts.length}.json` : STATES_FILE_NAME;
        this.downloadBlob(blob, name);
      }
      console.log(`Saved ${this.snapshotParts.length} snapshots, ${this.nextId - 1} ids (${(blob.size / 1e6).toFixed(1)} MB)`);
    } catch (e) {
      console.error("Saving states failed:", e);
    } finally {
      this.saving = false;
    }
  }

  /** "j": choose a file to save to (where supported), then save now. */
  private async chooseFileAndSave(): Promise<void> {
    const picker = (window as any).showSaveFilePicker;
    if (picker && !this.saveHandle) {
      try {
        this.saveHandle = await picker({
          suggestedName: STATES_FILE_NAME,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
      } catch {
        return; // picker cancelled
      }
    }
    await this.saveStates(false);
  }

  public download_data(): void {
    const header = "time\tx\ty\tangle\tlength\tID";
    const dataRows = this.bodies_params.map((d) => `${d.time}\t${d.x}\t${d.y}\t${d.angle}\t${d.length}\t${d.id}`);
    const dataStr = [header, ...dataRows].join("\n");
    const dataBlob = new Blob([dataStr], { type: "text/plain" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.download = "data.txt";
    link.href = url;
    link.click();
  }

  public override Keyboard(key: string): void {
    switch (key) {
      case "d":
        this.download_data();
        break;
      case "j":
        void this.chooseFileAndSave();
        break;
    }
  }

  public static Create(): testbed.Test {
    return new MicrofluidicBiofilm();
  }

  public calculateFactor(proportion: number, length: number, a: number): number {
    return proportion * (1 / 2) * length + (a / 2);
  }

  public calculateFactor2(length: number, a: number, proportion: number): number {
    return (length - (2 * a)) * proportion;
  }

  public calculateOffset(factor: number, originalAngle: number): b2.Vec2 {
    return new b2.Vec2(-factor * Math.sin(originalAngle), factor * Math.cos(originalAngle));
  }

  public calculateNewPosition(originalPosition: b2.Vec2, offset: b2.Vec2): b2.Vec2 {
    return new b2.Vec2(originalPosition.x - offset.x, originalPosition.y - offset.y);
  }

  public createBody(vec1: b2.Vec2, vec2: b2.Vec2): void {
    const bodyDef = new b2.BodyDef();
    const body = this.m_world.CreateBody(bodyDef);
    const edge = new b2.EdgeShape();
    edge.SetTwoSided(vec1, vec2);
    body.CreateFixture(edge, 0);
  }

  public createTriangleBody(x: number, y: number, vertices: b2.Vec2[]): void {
    const triangleBodyDef = new b2.BodyDef();
    triangleBodyDef.position.Set(x, y);
    const triangleBody = this.m_world.CreateBody(triangleBodyDef);
    const triangleShape = new b2.PolygonShape();
    triangleShape.Set(vertices, 3);
    triangleBody.CreateFixture(triangleShape, 0);
  }

  public createTrianglesx(count: number, ...vecs: b2.Vec2[][]): void {
    for (let i = 0; i < count; i++) {
      vecs.forEach((vec) => this.createTriangleBody(i * 5, 0, vec));
    }
  }

  public createTrianglesy(count: number, ...vecs: b2.Vec2[][]): void {
    for (let i = 0; i < count; i++) {
      vecs.forEach((vec) => this.createTriangleBody(0, i * 5, vec));
    }
  }

  public createContainer(...vecs: b2.Vec2[][]): void {
    vecs.forEach((vec) => this.createBody(vec[0], vec[1]));
  }

  public createBacteria(world: b2.World, position: b2.XY, angle: number, length: number, myColor: b2.Color, parentId: number): Bacterium {
    const random = Math.random();
    const bd = new b2.BodyDef();
    bd.type = b2.BodyType.b2_dynamicBody;
    bd.position.Set(position.x, position.y);
    bd.angle = angle;
    const body = world.CreateBody(bd) as Bacterium;
    const a = 0.5;
    const b = length / 2;
    // Set restitution for the box
    const boxFixtureDef = { shape: new b2.PolygonShape().SetAsBox(a, b), density: 0.0001, restitution: 0.0, friction: random };
    body.CreateFixture(boxFixtureDef);
    const circleShape = new b2.CircleShape(a);
    // Set restitution for the circles
    const circleFixtureDef = { shape: circleShape, density: 0.0001, restitution: 0.0, friction: random };
    [-b, b].forEach((dy) => {
      circleShape.m_p.Set(0, dy);
      body.CreateFixture(circleFixtureDef);
    });
    body.growthRate = GROWTH_RATE;
    body.reproductiveLength = 6 + (Math.random() - 0.5) * 2.5;
    body.myCustomColor = myColor;
    body.id = this.nextId++;
    this.lineage[body.id] = parentId;
    return body;
  }

  public createJointsToNearbyBodies(world: b2.World, body: b2.Body, maxDistance: number): void {
    const bodyPos = body.GetWorldCenter();

    for (let otherBody = world.GetBodyList(); otherBody; otherBody = otherBody.GetNext()) {
      if (otherBody === body) { continue; }

      const otherBodyPos = otherBody.GetWorldCenter();
      const distanceVec = b2.Vec2.SubVV(bodyPos, otherBodyPos, new b2.Vec2());
      const distance = distanceVec.Length();

      if (distance <= maxDistance) {
        const jd = new b2.DistanceJointDef();
        const frequencyHz = 1;
        const dampingRatio = 0.3;

        jd.bodyA = body;
        jd.bodyB = otherBody;
        b2.LinearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
        jd.localAnchorA.Set(0.0, 0.0);
        jd.localAnchorB.Set(0.0, 0.0);
        const p1 = jd.bodyA.GetWorldPoint(jd.localAnchorA, new b2.Vec2());
        const p2 = jd.bodyB.GetWorldPoint(jd.localAnchorB, new b2.Vec2());
        const d = b2.Vec2.SubVV(p2, p1, new b2.Vec2());
        jd.length = d.Length();
        jd.collideConnected = true;

        world.CreateJoint(jd);
      }
    }
  }

  public createStaticJoints(world: b2.World, body: b2.Body): void {
    // First, create a static ground body at the body's current position
    const groundBodyDef = new b2.BodyDef();
    groundBodyDef.position.Set(body.GetPosition().x, body.GetPosition().y);
    const ground = world.CreateBody(groundBodyDef);

    // Then, define a joint between the body and the new static ground body
    const jd = new b2.DistanceJointDef();
    const frequencyHz = 0.8;
    const dampingRatio = 0.3;

    jd.bodyA = body;
    jd.bodyB = ground;
    // Set anchor points on both bodies to the current position, assuming the reference point is at the center
    jd.localAnchorA.Set(0, 0);
    jd.localAnchorB.Set(0, 0);

    // Applying linear stiffness to the joint definition
    b2.LinearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);

    // Since both anchors are at the bodies' centers, we set length to 0 for a joint without slack
    jd.length = 0;
    jd.collideConnected = false;

    // Finally, create the joint in the world
    world.CreateJoint(jd);
    ground.SetUserData({ creationTime: Date.now() });
  }
}

export const testIndex: number = testbed.RegisterTest("Stacking", "Microfluidic Biofilm", MicrofluidicBiofilm.Create);
