// MIT License
System.register(["@box2d", "@testbed"], function (exports_1, context_1) {
    "use strict";
    var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var b2, testbed, MIN_X, MAX_X, MIN_Y, MAX_Y, MIN_SIZE, MAX_SIZE, COLOR, REPRODUCTION_PROPORTION_MIN, REPRODUCTION_PROPORTION_MAX, RANDOM_THRESHOLD, JOINT_CREATION_THRESHOLD, RATE, GROWTH_RATE, MODIFIED_GROWTH_RATE, TIME_STEP_INTERVAL, AIR_RESISTANCE, ANGULAR_AIR_RESISTANCE, SNAPSHOT_INTERVAL, AUTO_SAVE_EVERY_SNAPSHOTS, STATES_FILE_NAME, MicrofluidicBiofilm, testIndex;
    var __moduleName = context_1 && context_1.id;
    /** Round to 2 decimals (the LowRes coarse graining). */
    function round2(v) {
        return Math.round(v * 100) / 100;
    }
    /** Orientation as a fraction of π in [0, 1]. */
    function orientationOf(angle) {
        return angle > 0 ? (angle / Math.PI) % 1 : 1 + (angle / Math.PI) % 1;
    }
    /** Distance between the centres of the two end-cap circles. */
    function lengthOf(body) {
        const centres = [];
        for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
            const shape = fixture.GetShape();
            if (shape.GetType() === b2.ShapeType.e_circleShape) {
                centres.push(shape.m_p);
            }
        }
        return centres.length >= 2 ? b2.Vec2.DistanceVV(centres[0], centres[1]) : 0;
    }
    return {
        setters: [
            function (b2_1) {
                b2 = b2_1;
            },
            function (testbed_1) {
                testbed = testbed_1;
            }
        ],
        execute: function () {
            MIN_X = -50, MAX_X = 50; // X range
            MIN_Y = 140, MAX_Y = 200; // Y range
            MIN_SIZE = 3, MAX_SIZE = 6; // Size range of the initial bacteria
            COLOR = new b2.Color(0.3, 0.35, 0.3); // Color
            REPRODUCTION_PROPORTION_MIN = 0.3; // Minimum proportion of the parent's length for the child
            REPRODUCTION_PROPORTION_MAX = 0.2; // 0.3 + 0.2 = 0.5 maximum proportion of the parent's length for the child
            RANDOM_THRESHOLD = 0.001 * 0.15;
            JOINT_CREATION_THRESHOLD = 0.0025;
            RATE = 0.002 * 0.8;
            GROWTH_RATE = 1 + RATE;
            MODIFIED_GROWTH_RATE = 1 + (RATE * 1);
            TIME_STEP_INTERVAL = 150;
            AIR_RESISTANCE = 0.007;
            ANGULAR_AIR_RESISTANCE = 0.007;
            // State export (same format as LowRes.json): press "j" to save; auto-saves periodically.
            SNAPSHOT_INTERVAL = 150; // simulation steps between snapshots (must be a multiple of 25)
            AUTO_SAVE_EVERY_SNAPSHOTS = 500; // auto-save after this many snapshots
            STATES_FILE_NAME = "states.json";
            MicrofluidicBiofilm = class MicrofluidicBiofilm extends testbed.Test {
                constructor() {
                    super();
                    this.dynamicBodyCount = 0;
                    this.time_step = 0;
                    this.data = [];
                    this.bodies_params = [];
                    // State export
                    this.nextId = 1;
                    this.lineage = []; // lineage[childId] = parentId (0 for the initial cells)
                    this.snapshotParts = []; // one serialized `"n":[...]` entry per snapshot
                    this.saveHandle = null;
                    this.saving = false;
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
                Step(settings) {
                    super.Step(settings);
                    if (!settings.m_pause) {
                        this.time_step += 1;
                        if (this.time_step % 25 === 0) {
                            for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
                                if (b.GetType() === b2.BodyType.b2_dynamicBody) {
                                    const body = b;
                                    const circlePositions = [];
                                    for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
                                        const shape = fixture.GetShape();
                                        const isPolygon = shape.GetType() === b2.ShapeType.e_polygonShape;
                                        const isCircle = shape.GetType() === b2.ShapeType.e_circleShape;
                                        if (isPolygon) {
                                            shape.m_vertices.forEach((vertex) => vertex.y *= body.growthRate);
                                        }
                                        else if (isCircle) {
                                            shape.m_p.y *= body.growthRate;
                                            circlePositions.push(shape.m_p);
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
                                        this.createBacteria(this.m_world, newPosition1, originalAngle, factor2A, body.myCustomColor, body.id);
                                        this.createBacteria(this.m_world, newPosition2, originalAngle, factor2B, body.myCustomColor, body.id);
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
                                    }
                                    else {
                                        body.myCustomColor = new b2.Color(0.8, 0.1, 0.6);
                                        body.growthRate = GROWTH_RATE;
                                    }
                                    if (this.time_step % TIME_STEP_INTERVAL === 0) {
                                        let orientation;
                                        if (originalAngle > 0) {
                                            orientation = (originalAngle / Math.PI) % 1;
                                        }
                                        else {
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
                                const body = b;
                                if (body.userData && body.userData.destroy) {
                                    this.m_world.DestroyBody(body);
                                    this.dynamicBodyCount--;
                                }
                            }
                            const JOINT_LIFETIME_MS = 200000; // 1 second
                            for (let joint = this.m_world.GetJointList(); joint; joint = joint.GetNext()) {
                                if (Date.now() - joint.creationTime >= JOINT_LIFETIME_MS) {
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
                takeSnapshot() {
                    const alive = [];
                    for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
                        if (b.GetType() !== b2.BodyType.b2_dynamicBody) {
                            continue;
                        }
                        const body = b;
                        if (body.userData && body.userData.destroy) {
                            continue;
                        }
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
                buildStatesBlob() {
                    const parts = ["{"];
                    this.snapshotParts.forEach((part, i) => {
                        if (i > 0) {
                            parts.push(",");
                        }
                        parts.push(part);
                    });
                    const lineageEntries = [];
                    for (let id = 1; id < this.nextId; id++) {
                        lineageEntries.push(`"${id}":${this.lineage[id]}`);
                    }
                    parts.push(this.snapshotParts.length > 0 ? "," : "", `"lineage":{${lineageEntries.join(",")}}}`);
                    return new Blob(parts, { type: "application/json" });
                }
                downloadBlob(blob, fileName) {
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
                saveStates(auto) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (this.saving) {
                            return;
                        } // previous save still running
                        this.saving = true;
                        try {
                            const blob = this.buildStatesBlob();
                            if (this.saveHandle) {
                                const writable = yield this.saveHandle.createWritable();
                                yield writable.write(blob);
                                yield writable.close();
                            }
                            else {
                                const name = auto ? `states_${this.snapshotParts.length}.json` : STATES_FILE_NAME;
                                this.downloadBlob(blob, name);
                            }
                            console.log(`Saved ${this.snapshotParts.length} snapshots, ${this.nextId - 1} ids (${(blob.size / 1e6).toFixed(1)} MB)`);
                        }
                        catch (e) {
                            console.error("Saving states failed:", e);
                        }
                        finally {
                            this.saving = false;
                        }
                    });
                }
                /** "j": choose a file to save to (where supported), then save now. */
                chooseFileAndSave() {
                    return __awaiter(this, void 0, void 0, function* () {
                        const picker = window.showSaveFilePicker;
                        if (picker && !this.saveHandle) {
                            try {
                                this.saveHandle = yield picker({
                                    suggestedName: STATES_FILE_NAME,
                                    types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
                                });
                            }
                            catch (_a) {
                                return; // picker cancelled
                            }
                        }
                        yield this.saveStates(false);
                    });
                }
                download_data() {
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
                Keyboard(key) {
                    switch (key) {
                        case "d":
                            this.download_data();
                            break;
                        case "j":
                            void this.chooseFileAndSave();
                            break;
                    }
                }
                static Create() {
                    return new MicrofluidicBiofilm();
                }
                calculateFactor(proportion, length, a) {
                    return proportion * (1 / 2) * length + (a / 2);
                }
                calculateFactor2(length, a, proportion) {
                    return (length - (2 * a)) * proportion;
                }
                calculateOffset(factor, originalAngle) {
                    return new b2.Vec2(-factor * Math.sin(originalAngle), factor * Math.cos(originalAngle));
                }
                calculateNewPosition(originalPosition, offset) {
                    return new b2.Vec2(originalPosition.x - offset.x, originalPosition.y - offset.y);
                }
                createBody(vec1, vec2) {
                    const bodyDef = new b2.BodyDef();
                    const body = this.m_world.CreateBody(bodyDef);
                    const edge = new b2.EdgeShape();
                    edge.SetTwoSided(vec1, vec2);
                    body.CreateFixture(edge, 0);
                }
                createTriangleBody(x, y, vertices) {
                    const triangleBodyDef = new b2.BodyDef();
                    triangleBodyDef.position.Set(x, y);
                    const triangleBody = this.m_world.CreateBody(triangleBodyDef);
                    const triangleShape = new b2.PolygonShape();
                    triangleShape.Set(vertices, 3);
                    triangleBody.CreateFixture(triangleShape, 0);
                }
                createTrianglesx(count, ...vecs) {
                    for (let i = 0; i < count; i++) {
                        vecs.forEach((vec) => this.createTriangleBody(i * 5, 0, vec));
                    }
                }
                createTrianglesy(count, ...vecs) {
                    for (let i = 0; i < count; i++) {
                        vecs.forEach((vec) => this.createTriangleBody(0, i * 5, vec));
                    }
                }
                createContainer(...vecs) {
                    vecs.forEach((vec) => this.createBody(vec[0], vec[1]));
                }
                createBacteria(world, position, angle, length, myColor, parentId) {
                    const random = Math.random();
                    const bd = new b2.BodyDef();
                    bd.type = b2.BodyType.b2_dynamicBody;
                    bd.position.Set(position.x, position.y);
                    bd.angle = angle;
                    const body = world.CreateBody(bd);
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
                createJointsToNearbyBodies(world, body, maxDistance) {
                    const bodyPos = body.GetWorldCenter();
                    for (let otherBody = world.GetBodyList(); otherBody; otherBody = otherBody.GetNext()) {
                        if (otherBody === body) {
                            continue;
                        }
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
                createStaticJoints(world, body) {
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
            };
            exports_1("MicrofluidicBiofilm", MicrofluidicBiofilm);
            exports_1("testIndex", testIndex = testbed.RegisterTest("Stacking", "Microfluidic Biofilm", MicrofluidicBiofilm.Create));
        }
    };
});
//# sourceMappingURL=microfluidic_biofilm.js.map