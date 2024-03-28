// MIT License

System.register(["@box2d", "@testbed", '@tensorflow/tfjs'], function (exports_1, context_1) {
    "use strict";
    var b2, testbed, tf, Pyramid, testIndex;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (b2_1) {
                b2 = b2_1;
            },
            function (testbed_1) {
                testbed = testbed_1;
            },
            function (tf_1) {
                tf = tf_1;
            }
        ],
        execute: function () {
            
            
            Pyramid = class Pyramid extends testbed.Test {
                
                constructor() {
                    

                    super();
                    this.m_world.SetGravity(new b2.Vec2(0, 0));

                    // Create the ground body
                    let groundBodyDef = new b2.BodyDef();
                    let groundBody = this.m_world.CreateBody(groundBodyDef);
                    let groundEdge = new b2.EdgeShape();
                    groundEdge.SetTwoSided(new b2.Vec2(-50, 200), new b2.Vec2(50, 200));
                    groundBody.CreateFixture(groundEdge, 0);

                    // Create the wall body
                    let wallBodyDef = new b2.BodyDef();
                    let wallBody = this.m_world.CreateBody(wallBodyDef);
                    let wallEdge = new b2.EdgeShape();
                    wallEdge.SetTwoSided(new b2.Vec2(50, 200), new b2.Vec2(50, 140));
                    wallBody.CreateFixture(wallEdge, 0);

                    // Create the wall body
                    let wallBodyDef2 = new b2.BodyDef();
                    let wallBody2 = this.m_world.CreateBody(wallBodyDef2);
                    let wallEdge2 = new b2.EdgeShape();
                    wallEdge2.SetTwoSided(new b2.Vec2(-50, 200), new b2.Vec2(-50, 140));
                    wallBody2.CreateFixture(wallEdge2, 0);


                    // Let's create some static bodies with the shape of a triangle
                    for(let i = 0; i < 12; i++) {
                        let triangleBodyDef = new b2.BodyDef();
                        triangleBodyDef.position.y = i * 5; // Adjust the multiplier as needed to space the triangles
                        let triangleBody = this.m_world.CreateBody(triangleBodyDef);
                        let triangleShape = new b2.PolygonShape();
                        triangleShape.Set([new b2.Vec2(50, 140), new b2.Vec2(50, 142), new b2.Vec2(49.5, 141)], 3);
                        triangleBody.CreateFixture(triangleShape, 0);
                    }

                    // Let's create some static bodies with the shape of a triangle
                    for(let i = 0; i < 12; i++) {
                        let triangleBodyDef = new b2.BodyDef();
                        triangleBodyDef.position.y = i * 5; // Adjust the multiplier as needed to space the triangles
                        let triangleBody = this.m_world.CreateBody(triangleBodyDef);
                        let triangleShape = new b2.PolygonShape();
                        triangleShape.Set([new b2.Vec2(-50, 140), new b2.Vec2(-50, 142), new b2.Vec2(-49.5, 141)], 3);
                        triangleBody.CreateFixture(triangleShape, 0);
                    }

                        // Let's create some static bodies with the shape of a triangle
                        for(let i = 0; i < 20; i++) {
                            let triangleBodyDef = new b2.BodyDef();
                            triangleBodyDef.position.x = i * 5; // Adjust the multiplier as needed to space the triangles
                            let triangleBody = this.m_world.CreateBody(triangleBodyDef);
                            let triangleShape = new b2.PolygonShape();
                            triangleShape.Set([new b2.Vec2(-50, 200), new b2.Vec2(-48, 200), new b2.Vec2(-49, 199.5)], 3);
                            triangleBody.CreateFixture(triangleShape, 0);
                        }
                    

                    this.dynamicBodyCount = 0;
                    // Define the area within which the bodies should be distributed
                    let minX = -49, maxX = 49; // X range
                    let minY = 140, maxY = 199; // Y range

                    for (let i = 0; i < 1000; ++i) {
                        // Generate a random position within the defined area
                        let x = Math.random() * (maxX - minX) + minX;
                        let y = Math.random() * (maxY - minY) + minY;

                        // Generate a random angle between 0 and 2π
                        let random_number=Math.random();
                        let angle = random_number * 2 * Math.PI;

                        if (random_number < 0.04) {
                            this.createBacteria(this.m_world, new b2.Vec2(x, y), angle ,Math.random() * (3) + 3,new b2.Color(0.1, 0.8, 0.18),  "bac");
                            this.dynamicBodyCount++;
                        } else {
                            this.createBacteria(this.m_world, new b2.Vec2(x, y), angle ,Math.random() * (3) + 3,new b2.Color(0.3, 0.35, 0.3),  "bac");
                            this.dynamicBodyCount++;
                        }

                        
                    }

    


                    this.time_step = 0;
                    this.data=[];
                }

     
                createBacteria(world, position, angle, length, myColor, tag) {
                    const bd = new b2.BodyDef();
                    bd.type = b2.BodyType.b2_dynamicBody;
                    bd.position.Set(position.x, position.y);
                    bd.angle = angle; 
                    const body = world.CreateBody(bd);
                    let a = 0.4; 
                    let b = length/2; 
                    // Set restitution for the box
                    const boxFixtureDef = {shape: new b2.PolygonShape().SetAsBox(a, b), density: 0.0001, restitution: 0.0, friction: 0};
                    body.CreateFixture(boxFixtureDef);
                    const circleShape = new b2.CircleShape(a); 
                    // Set restitution for the circles
                    const circleFixtureDef = {shape: circleShape, density: 0.0001, restitution: 0.0, friction: 0};
                    [-b, b].forEach(dy => {
                        circleShape.m_p.Set(0, dy);
                        body.CreateFixture(circleFixtureDef);
                    });
                    body.growthRate = 1.01300;//1.0300
                    body.reproductiveLength = 6 + (Math.random()-0.5)*2.5;
                    body.myCustomColor = myColor;

                   
                    body.tag = tag;
                    
                    return body;
                }

                createJointsToNearbyBodies(world, body, maxDistance) {
                    let bodyPos = body.GetWorldCenter();
                    
                    for (let otherBody = world.GetBodyList(); otherBody; otherBody = otherBody.GetNext()) {
                        if (otherBody === body) continue;

                        
                        let otherBodyPos = otherBody.GetWorldCenter();
                        let distanceVec = b2.Vec2.SubVV(bodyPos, otherBodyPos, new b2.Vec2());
                        let distance = distanceVec.Length();
                        
                        if (distance <= maxDistance) {
                            const jd = new b2.DistanceJointDef();
                            let p1, p2, d;
                            const frequencyHz = 1;
                            const dampingRatio = 0.3;
                            
                            jd.bodyA = body;
                            jd.bodyB = otherBody;
                            b2.LinearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
                            jd.localAnchorA.Set(0.0, 0.0);
                            jd.localAnchorB.Set(0.0, 0.0);
                            p1 = jd.bodyA.GetWorldPoint(jd.localAnchorA, new b2.Vec2());
                            p2 = jd.bodyB.GetWorldPoint(jd.localAnchorB, new b2.Vec2());
                            d = b2.Vec2.SubVV(p2, p1, new b2.Vec2());
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







                download_data() {
                    const header = 'bodyCount\ttimeStep';
                    const dataRows = this.data.map(d => `${d.bodyCount}\t${d.timeStep}`);
                    const dataStr = [header, ...dataRows].join('\n');
                    const dataBlob = new Blob([dataStr], {type: 'text/plain'});
                    const url = URL.createObjectURL(dataBlob);

                    const link = document.createElement('a');
                    link.download = 'data.txt';
                    link.href = url;
                    link.click();
                }

                Keyboard(key) {
                    switch (key) {
                        case "d":
                            this.download_data();
                            break;
                    }
                }



                Step(settings) {
                    super.Step(settings);
                    if (!settings.m_pause) {
                        this.time_step += 1;
                        
                        if (this.time_step % 25 === 0) {

                    
                    for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                        if (body.GetType() === b2.BodyType.b2_dynamicBody) {     

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
             
                                    if (length >= body.reproductiveLength) {
                                        let a=0.4;
                                        let proportion = 0.3 + Math.random()*0.2;
                                        let originalAngle = body.GetAngle();
                                        let factorA = proportion*(1/2)*length+(a/2);
                                        let factorB = (1-proportion)*(1/2)*length+(a/2);
                                        let factor2A = (length-(2*a))*proportion;
                                        let factor2B = (length-(2*a))*(1-proportion);
                                        let offsetA = new b2.Vec2(-factorA * Math.sin(originalAngle), factorA * Math.cos(originalAngle));
                                        let offsetB = new b2.Vec2(-factorB * Math.sin(originalAngle), factorB * Math.cos(originalAngle));
                                        let newPosition1 = new b2.Vec2(originalPosition.x - offsetB.x, originalPosition.y - offsetB.y);
                                        let newPosition2 = new b2.Vec2(originalPosition.x + offsetA.x, originalPosition.y + offsetA.y);
                                        let newTag1= body.tag;
                                        let newTag2= body.tag;

                                        if (Math.random() < 0.01) {
                                            body.myCustomColor = new b2.Color(0.1, 0.8, 0.18);
                                        }
                    
                                        this.createBacteria(this.m_world, newPosition1, originalAngle, factor2A, body.myCustomColor,  newTag1);
                                        this.createBacteria(this.m_world, newPosition2, originalAngle, factor2B, body.myCustomColor, newTag2);

    
                                       // this.createJoints(this.m_world, body1, body2, factor2A, factor2B);


                                        this.dynamicBodyCount++;
                                        this.dynamicBodyCount++;
                                        body.userData = { destroy: true };
                                    }

                                    if (originalPosition.x < -50 || originalPosition.x > 50 || originalPosition.y < 140 || originalPosition.y >200  || Math.random() < 0.001) {
                                        body.userData = { destroy: true };
                                    }

                   

                                   /*    if (Math.random() < 0.01){
                                        this.createJointsToNearbyBodies(this.m_world, body, 2);
                                      }   */

                                    if ( ( (originalPosition.y>195)  ||   (originalPosition.x < -45 || originalPosition.x > 45) ) && Math.random() < 0.50) {
                                        this.createStaticJoints(this.m_world, body);
                                    }


                                    if (originalPosition.x < 45 && originalPosition.x > -45 && originalPosition.y < 145) {
                                        body.ApplyForce(new b2.Vec2(0, -0.002), body.GetWorldCenter());
                                    }

                                 



            
                        
                            }
                           
                        }
                    

                   
                    for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                    
                            if (body.userData && body.userData.destroy) {
                                this.m_world.DestroyBody(body);
                                this.dynamicBodyCount--;

                            }

                            
                        
                    }


                    const JOINT_LIFETIME_MS = 500;  // 1 second

                    // In your update loop...
                    for (let joint = this.m_world.GetJointList(); joint; joint = joint.GetNext()) {
                        if (Date.now() - joint.creationTime >= JOINT_LIFETIME_MS) {
                            this.m_world.DestroyJoint(joint);
                        }
                    }

 

                    const BODY_LIFETIME_MS = 1000;  

                    // In your update loop...
                    for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                        const userData = body.GetUserData();
                        if (userData && Date.now() - userData.creationTime >= BODY_LIFETIME_MS) {
                            this.m_world.DestroyBody(body);
                        }
                    }

           

                  





                    this.data.push({bodyCount: this.dynamicBodyCount, timeStep: this.time_step});
                }


        }     
                }

                
                    
                static Create() {
                    return new Pyramid();
                    
                }
            };
            exports_1("Pyramid", Pyramid);
            exports_1("testIndex", testIndex = testbed.RegisterTest("Stacking", "Microfluidic Biofilm", Pyramid.Create));
        }
    };
});
