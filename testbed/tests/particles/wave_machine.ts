/*
 * Copyright (c) 2006-2012 Erin Catto http://www.box2d.org
 *
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the authors be held liable for any damages
 * arising from the use of this software.
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 * 1. The origin of this software must not be misrepresented; you must not
 * claim that you wrote the original software. If you use this software
 * in a product, an acknowledgment in the product documentation would be
 * appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 * misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 */

// #if B2_ENABLE_PARTICLE

import * as b2 from "@box2d";
import * as testbed from "@testbed";

/** Extra per-body state attached to each bacterium. */
interface Bacterium extends b2.Body {
  growthRate: number;
  reproductiveLength: number;
  tag?: string;
  userData?: { destroy?: boolean };
}

export class WaveMachine extends testbed.Test {
  public dynamicBodyCount: number = 0;
  public time_step: number = 0;
  public data: unknown[] = [];
  public bodies_params: unknown[] = [];

  constructor() {
    super();
    this.m_world.SetGravity(new b2.Vec2(0, 0));

    // Create the ground body
    const groundBodyDef = new b2.BodyDef();
    const groundBody = this.m_world.CreateBody(groundBodyDef);
    const groundEdge = new b2.EdgeShape();
    groundEdge.SetTwoSided(new b2.Vec2(-100, 50), new b2.Vec2(100, 50));
    groundBody.CreateFixture(groundEdge, 0);

    // Create the roof body
    const roofBodyDef = new b2.BodyDef();
    const roofBody = this.m_world.CreateBody(roofBodyDef);
    const roofEdge = new b2.EdgeShape();
    roofEdge.SetTwoSided(new b2.Vec2(-100, -50), new b2.Vec2(100, -50));
    roofBody.CreateFixture(roofEdge, 0);

    // Create the wall body
    const wallBodyDef = new b2.BodyDef();
    const wallBody = this.m_world.CreateBody(wallBodyDef);
    const wallEdge = new b2.EdgeShape();
    wallEdge.SetTwoSided(new b2.Vec2(100, 50), new b2.Vec2(100, -50));
    wallBody.CreateFixture(wallEdge, 0);

    // Create the wall body
    const wallBodyDef2 = new b2.BodyDef();
    const wallBody2 = this.m_world.CreateBody(wallBodyDef2);
    const wallEdge2 = new b2.EdgeShape();
    wallEdge2.SetTwoSided(new b2.Vec2(-100, 50), new b2.Vec2(-100, -50));
    wallBody2.CreateFixture(wallEdge2, 0);
    this.dynamicBodyCount = 0;
    const minX = -50, maxX = 49; // X range
    const minY = -50, maxY = 50; // Y range
    for (let i = 0; i < 5; ++i) {
      // Generate a random position within the defined area
      const x = Math.random() * (maxX - minX) + minX;
      const y = Math.random() * (maxY - minY) + minY;

      // Generate a random angle between 0 and 2π
      const random_number = Math.random();
      const angle = random_number * 2 * Math.PI;

      //angle = Math.PI*5;
      this.createBacteria(this.m_world, new b2.Vec2(x, y), angle, 3, new b2.Color(0.3, 0.35, 0.3), "new");
      this.dynamicBodyCount++;
    }

    this.time_step = 0;
    this.data = [];
    this.bodies_params = [];
  }

  public createJoints1(world: b2.World, body1: b2.Body, body2: b2.Body, length1: number, length2: number): void {
    this.createWeld(world, body1, body2, length1, length2, 2);
  }

  public createJoints2(world: b2.World, body1: b2.Body, body2: b2.Body, length1: number, length2: number): void {
    this.createWeld(world, body1, body2, length1, length2, 0.5);
  }

  private createWeld(world: b2.World, body1: b2.Body, body2: b2.Body, length1: number, length2: number, frequencyHz: number): void {
    const jd = new b2.WeldJointDef();
    const dampingRatio = 10;

    jd.bodyA = body1;
    jd.bodyB = body2;
    // Calculate linear stiffness and apply to the joint definition
    b2.LinearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
    jd.localAnchorA.Set(0, length1 / 2 + 0.4);
    jd.localAnchorB.Set(0, -length2 / 2 - 0.4);

    // Calculating the natural length of the joint based on current positions
    // (a weld joint has no length; this extra field is kept from the original JS and is ignored)
    const p1 = jd.bodyA.GetWorldPoint(jd.localAnchorA, new b2.Vec2());
    const p2 = jd.bodyB.GetWorldPoint(jd.localAnchorB, new b2.Vec2());
    const d = b2.Vec2.SubVV(p2, p1, new b2.Vec2());
    (jd as any).length = d.Length();

    jd.collideConnected = true;

    // Create the joint in the world
    const joint = world.CreateJoint(jd);

    (joint as any).creationTime = Date.now();
  }

  public createBacteria(world: b2.World, position: b2.XY, angle: number, length: number, myColor: b2.Color, tag: string): Bacterium {
    const bd = new b2.BodyDef();

    bd.type = b2.BodyType.b2_dynamicBody;

    bd.position.Set(position.x, position.y);
    bd.angle = angle;
    const body = world.CreateBody(bd) as Bacterium;
    const a = 0.5;
    const b = length / 2;
    // Set restitution for the box
    const boxFixtureDef = { shape: new b2.PolygonShape().SetAsBox(a, b), density: 0.0001, restitution: 0.0, friction: 2 };
    body.CreateFixture(boxFixtureDef);
    const circleShape = new b2.CircleShape(a);
    // Set restitution for the circles
    const circleFixtureDef = { shape: circleShape, density: 0.0001, restitution: 0.0, friction: 2 };
    [-b, b].forEach((dy) => {
      circleShape.m_p.Set(0, dy);
      body.CreateFixture(circleFixtureDef);
    });
    body.growthRate = 1.0400; //1.00400
    body.reproductiveLength = 3;
    body.myCustomColor = myColor;
    // Increase air friction to its maximum value
    body.GetFixtureList()!.SetFriction(2);

    body.tag = tag;

    return body;
  }

  public override Step(settings: testbed.Settings): void {
    super.Step(settings);

    if (!settings.m_pause) {
      this.time_step += 1;
      if (this.time_step % 5 === 0) {

        for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
          const body = b as Bacterium;

          if (body.tag === "new") {

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
            }
            const diff = new b2.Vec2(circlePositions[0].x - circlePositions[1].x, circlePositions[0].y - circlePositions[1].y);
            const length = diff.Length();
            const originalPosition = body.GetPosition();
            const originalAngle = body.GetAngle();

            if (length >= body.reproductiveLength) {
              const a = 0.5;
              const proportion = 0.5;
              const factorA = proportion * (1 / 2) * length + (a / 2);
              const factorB = (1 - proportion) * (1 / 2) * length + (a / 2);
              const factor2A = (length - (2 * a)) * proportion;
              const factor2B = (length - (2 * a)) * (1 - proportion);
              const offsetA = new b2.Vec2(-factorA * Math.sin(originalAngle), factorA * Math.cos(originalAngle));
              const offsetB = new b2.Vec2(-factorB * Math.sin(originalAngle), factorB * Math.cos(originalAngle));
              const newPosition1 = new b2.Vec2(originalPosition.x - offsetB.x, originalPosition.y - offsetB.y);
              const newPosition2 = new b2.Vec2(originalPosition.x + offsetA.x, originalPosition.y + offsetA.y);
              const newTag1 = "old";
              const newTag2 = "new";

              const bacteria1 = this.createBacteria(this.m_world, newPosition1, originalAngle, factor2A, body.myCustomColor!, newTag1);
              const bacteria2 = this.createBacteria(this.m_world, newPosition2, originalAngle, factor2B, body.myCustomColor!, newTag2);

              this.createJoints1(this.m_world, bacteria1, bacteria2, factor2A, factor2B);
              let jointEdge = body.GetJointList();
              while (jointEdge) {
                const joint = jointEdge.joint;
                const attachedBody = joint.GetBodyA() === body ? joint.GetBodyB() : joint.GetBodyA();

                // Create a joint between bacteria2 and the attached body
                this.createJoints2(this.m_world, attachedBody, bacteria1, factor2A, factor2B);

                jointEdge = jointEdge.next;
              }
              //this.createWeldJoint(this.m_world, bacteria1, bacteria2);

              this.dynamicBodyCount++;
              this.dynamicBodyCount++;
              body.userData = { destroy: true };
            }
          }
        }

        for (let b = this.m_world.GetBodyList(); b; b = b.GetNext()) {
          const body = b as Bacterium;
          if (Math.random() < 0.0001) {
            body.SetType(b2.BodyType.b2_staticBody);
          }
          if (body.userData && body.userData.destroy) {
            this.m_world.DestroyBody(body);
            this.dynamicBodyCount--;
          }
        }
      }
    }
  }

  public override GetDefaultViewZoom(): number {
    return 1;
  }

  public static Create(): testbed.Test {
    return new WaveMachine();
  }
}

export const testIndex: number = testbed.RegisterTest("Particles", "Wave Machine", WaveMachine.Create);

// #endif
