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
System.register(["@box2d", "@testbed", '@tensorflow/tfjs'], function (exports_1, context_1) {
    "use strict";
    var b2, testbed, WaveMachine, testIndex;
    var __moduleName = context_1 && context_1.id;
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
            WaveMachine = class WaveMachine extends testbed.Test {
                constructor() {
                    super();
                    this.m_world.SetGravity(new b2.Vec2(0, 0));

                                // Create the ground body
                                let groundBodyDef = new b2.BodyDef();
                                let groundBody = this.m_world.CreateBody(groundBodyDef);
                                let groundEdge = new b2.EdgeShape();
                                groundEdge.SetTwoSided(new b2.Vec2(-100, 50), new b2.Vec2(100, 50));
                                groundBody.CreateFixture(groundEdge, 0);

                                // Create the roof body
                                let roofBodyDef = new b2.BodyDef();
                                let roofBody = this.m_world.CreateBody(roofBodyDef);
                                let roofEdge = new b2.EdgeShape();
                                roofEdge.SetTwoSided(new b2.Vec2(-100, -50), new b2.Vec2(100, -50));
                                roofBody.CreateFixture(roofEdge, 0);
            
                                // Create the wall body
                                let wallBodyDef = new b2.BodyDef();
                                let wallBody = this.m_world.CreateBody(wallBodyDef);
                                let wallEdge = new b2.EdgeShape();
                                wallEdge.SetTwoSided(new b2.Vec2(100, 50), new b2.Vec2(100, -50));
                                wallBody.CreateFixture(wallEdge, 0);
            
                                // Create the wall body
                                let wallBodyDef2 = new b2.BodyDef();
                                let wallBody2 = this.m_world.CreateBody(wallBodyDef2);
                                let wallEdge2 = new b2.EdgeShape();
                                wallEdge2.SetTwoSided(new b2.Vec2(-100, 50), new b2.Vec2(-100, -50));
                                wallBody2.CreateFixture(wallEdge2, 0);
                                this.dynamicBodyCount = 0;
                                let minX = -50, maxX = 49; // X range
                                let minY = -50, maxY = 50; // Y range
                                for (let i = 0; i < 5; ++i) {
                                    // Generate a random position within the defined area
                                    let x = Math.random() * (maxX - minX) + minX;
                                    let y = Math.random() * (maxY - minY) + minY;
            
                                    // Generate a random angle between 0 and 2π
                                    let random_number=Math.random();
                                    let angle = random_number * 2 * Math.PI;
            
                 
                                        //angle = Math.PI*5;
                                        this.createBacteria(this.m_world, new b2.Vec2(x, y), angle , 3,new b2.Color(0.3, 0.35, 0.3),  "new");
                                        this.dynamicBodyCount++;
                                    
            
                                    
                                }

                                this.time_step = 0;
                                this.data=[];
                                this.bodies_params = [];      

                }


                createJoints1(world, body1, body2, length1, length2) {
                    const jd = new b2.WeldJointDef();
                    let p1, p2, d;
                    const frequencyHz = 2;
                    const dampingRatio = 10;



                    jd.bodyA = body1;
                    jd.bodyB = body2;
                    // Calculate linear stiffness and apply to the joint definition
                    b2.LinearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
                    jd.localAnchorA.Set(0,  length1/2+0.4 );
                    jd.localAnchorB.Set( 0, -length2/2-0.4 );

                    // Calculating the natural length of the joint based on current positions
                    p1 = jd.bodyA.GetWorldPoint(jd.localAnchorA, new b2.Vec2());
                    p2 = jd.bodyB.GetWorldPoint(jd.localAnchorB, new b2.Vec2());
                    d = b2.Vec2.SubVV(p2, p1, new b2.Vec2());
                    jd.length = d.Length();

                    jd.collideConnected = true;

                    // Create the joint in the world
                    const joint = world.CreateJoint(jd);

                    joint.creationTime = Date.now();
                }
                createJoints2(world, body1, body2, length1, length2) {
                    const jd = new b2.WeldJointDef();
                    let p1, p2, d;
                    const frequencyHz = 0.5;
                    const dampingRatio = 10;



                    jd.bodyA = body1;
                    jd.bodyB = body2;
                    // Calculate linear stiffness and apply to the joint definition
                    b2.LinearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
                    jd.localAnchorA.Set(0,  length1/2+0.4 );
                    jd.localAnchorB.Set( 0, -length2/2-0.4 );

                    // Calculating the natural length of the joint based on current positions
                    p1 = jd.bodyA.GetWorldPoint(jd.localAnchorA, new b2.Vec2());
                    p2 = jd.bodyB.GetWorldPoint(jd.localAnchorB, new b2.Vec2());
                    d = b2.Vec2.SubVV(p2, p1, new b2.Vec2());
                    jd.length = d.Length();

                    jd.collideConnected = true;

                    // Create the joint in the world
                    const joint = world.CreateJoint(jd);

                    joint.creationTime = Date.now();
                }


                createBacteria(world, position, angle, length, myColor, tag) {
                    const bd = new b2.BodyDef();
                    
                        bd.type = b2.BodyType.b2_dynamicBody;
                    
                    bd.position.Set(position.x, position.y);
                    bd.angle = angle; 
                    const body = world.CreateBody(bd);
                    let a = 0.5; 
                    let b = length/2; 
                    // Set restitution for the box
                    const boxFixtureDef = {shape: new b2.PolygonShape().SetAsBox(a, b), density: 0.0001, restitution: 0.0, friction: 2};
                    body.CreateFixture(boxFixtureDef);
                    const circleShape = new b2.CircleShape(a); 
                    // Set restitution for the circles
                    const circleFixtureDef = {shape: circleShape, density: 0.0001, restitution: 0.0, friction: 2};
                    [-b, b].forEach(dy => {
                        circleShape.m_p.Set(0, dy);
                        body.CreateFixture(circleFixtureDef);
                    });
                    body.growthRate = 1.0400;//1.00400
                    body.reproductiveLength = 3 ;
                    body.myCustomColor = myColor;
                    // Increase air friction to its maximum value
                    body.GetFixtureList().SetFriction(2);



                   
                    body.tag = tag;
                    
                    return body;
                }

                Step(settings) {
                    super.Step(settings);
            
                    if (!settings.m_pause) {
                        this.time_step += 1;
                        if (this.time_step % 5 === 0) {
                        
                            for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {

                          
                                if (body.tag === "new") {     
        
                                        let circlePositions = [];
                                        for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
                                            const shape = fixture.GetShape();
                                            const isPolygon = shape.GetType() === b2.ShapeType.e_polygonShape;
                                            const isCircle = shape.GetType() === b2.ShapeType.e_circleShape;
        
                                            if (isPolygon) {
                                                shape.m_vertices.forEach(vertex => vertex.y *= body.growthRate);
                                            } else if (isCircle) {
                                                shape.m_p.y *= body.growthRate;
                                                circlePositions.push(shape.m_p);
                                            }
                                        }
                                            const diff = new b2.Vec2(circlePositions[0].x - circlePositions[1].x, circlePositions[0].y - circlePositions[1].y);
                                            const length = diff.Length();
                                            let originalPosition = body.GetPosition();
                                            let originalAngle = body.GetAngle();
        
                     
                                            if (length >= body.reproductiveLength) {
                                                let a=0.5;
                                                let proportion = 0.5;
                                                let factorA = proportion*(1/2)*length+(a/2);
                                                let factorB = (1-proportion)*(1/2)*length+(a/2);
                                                let factor2A = (length-(2*a))*proportion;
                                                let factor2B = (length-(2*a))*(1-proportion);
                                                let offsetA = new b2.Vec2(-factorA * Math.sin(originalAngle), factorA * Math.cos(originalAngle));
                                                let offsetB = new b2.Vec2(-factorB * Math.sin(originalAngle), factorB * Math.cos(originalAngle));
                                                let newPosition1 = new b2.Vec2(originalPosition.x - offsetB.x, originalPosition.y - offsetB.y);
                                                let newPosition2 = new b2.Vec2(originalPosition.x + offsetA.x, originalPosition.y + offsetA.y);
                                                let newTag1= "old";
                                                let newTag2= "new";
        
                                    
                            
                                                let bacteria1=this.createBacteria(this.m_world, newPosition1, originalAngle, factor2A, body.myCustomColor,  newTag1);
                                                let bacteria2= this.createBacteria(this.m_world, newPosition2, originalAngle, factor2B, body.myCustomColor, newTag2);
                                                
                                                
            
                                                this.createJoints1(this.m_world, bacteria1, bacteria2, factor2A, factor2B);
                                                let jointEdge = body.GetJointList();
                                                while (jointEdge) {
                                                    let joint = jointEdge.joint;
                                                    let attachedBody = joint.GetBodyA() === body ? joint.GetBodyB() : joint.GetBodyA();
                                                
                                                    // Create a joint between bacteria2 and the attached body
                                                    this.createJoints2(this.m_world, attachedBody,bacteria1,factor2A, factor2B);
                                                
                                                    jointEdge = jointEdge.next;
                                                }
                                               //this.createWeldJoint(this.m_world, bacteria1, bacteria2);
        
                                                this.dynamicBodyCount++;
                                                this.dynamicBodyCount++;
                                                body.userData = { destroy: true };
                                            }
        
                            
                                
                                    }
                                   
                                }
                            
        
                                for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                                    if(Math.random() < 0.0001){
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
                GetDefaultViewZoom() {
                    return 1;
                }
                static Create() {
                    return new WaveMachine();
                }
            };
            exports_1("WaveMachine", WaveMachine);
            exports_1("testIndex", testIndex = testbed.RegisterTest("Particles", "Wave Machine", WaveMachine.Create));
        }
    };
});
//# sourceMappingURL=wave_machine.js.map