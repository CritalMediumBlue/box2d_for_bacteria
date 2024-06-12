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
                const MIN_X = -50, MAX_X = 50; // X range
                const MIN_Y = 140, MAX_Y = 200; // Y range
                const MIN_SIZE = 3, MAX_SIZE = 6; // Size range of the initial bacteria
                const COLOR = new b2.Color(0.3, 0.35, 0.3); // Color
                const REPRODUCTION_PROPORTION_MIN = 0.3; // Minimum proportion of the parent's length for the child
                const REPRODUCTION_PROPORTION_MAX = 0.2; // 0.3 + 0.2 = 0.5 maximum proportion of the parent's length for the child
                const RANDOM_THRESHOLD = 0.001 * 0.15;
                const JOINT_CREATION_THRESHOLD = 0.0025;
                const RATE = 0.002*0.8;
                const GROWTH_RATE = 1 + RATE;
                const MODIFIED_GROWTH_RATE = 1 + (RATE * 1);
                const TIME_STEP_INTERVAL = 300;
                const AIR_RESISTANCE = 0.007;
                const ANGULAR_AIR_RESISTANCE = 0.007;

                Pyramid = class Pyramid extends testbed.Test {
                    constructor() {
                        super();
                        this.m_world.SetGravity(new b2.Vec2(0, 0));

                        this.dynamicBodyCount = 0;

                        for (let i = 1; i <= 1000; ++i) {
                            // Generate a random position within the defined area
                            let x = Math.random() * (MAX_X - MIN_X) + MIN_X;
                            let y = Math.random() * (MAX_Y - MIN_Y) + MIN_Y;

                            // Generate a random angle between 0 and 2π
                            let angle = Math.random() * 2 * Math.PI;

                            // Generate a random size within the defined range
                            let size = 0.2*Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE;

                            this.createBacteria(this.m_world, new b2.Vec2(x, y), angle, size, COLOR, BigInt(1000+i));
                            this.dynamicBodyCount++;
                        }

                        this.time_step = 0;
                        this.data=[];
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
                                        const [{x: x1, y: y1}, {x: x2, y: y2}] = circlePositions;

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

                                          
                                            // Calculate the new tags
                                            const newTag1 = body.tag * BigInt(2);
                                            const newTag2 = newTag1 + BigInt(1);

                                       

                                            // Create new bacteria and increment body count
                                            this.createBacteria(this.m_world, newPosition1, originalAngle, factor2A, body.myCustomColor, newTag1);
                                            this.createBacteria(this.m_world, newPosition2, originalAngle, factor2B, body.myCustomColor, newTag2);
                                            this.dynamicBodyCount += 2;

                                            // Mark body for destruction
                                            body.userData = { destroy: true };
                                        }



                                        if (originalPosition.x < MIN_X || originalPosition.x > MAX_X || originalPosition.y < MIN_Y || originalPosition.y > MAX_Y || Math.random() < RANDOM_THRESHOLD) {
                                            body.userData = { destroy: true };
                                        }

                                        const Close_to_walls = (originalPosition.x < MIN_X+20 || originalPosition.x > MAX_X-20 );
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
                                                tag: body.tag,
                                                time: this.time_step/TIME_STEP_INTERVAL
                                            });
                                            

                                        }  
                        
                                    
                                    }
                                    
                                }


                                // Destroy bodies marked for destruction
                                
                                for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                                
                                    if (body.userData && body.userData.destroy) {
                                        this.m_world.DestroyBody(body);
                                        this.dynamicBodyCount--;
                                    }

                                }


                                const JOINT_LIFETIME_MS =200000;  // 1 second

                                for (let joint = this.m_world.GetJointList(); joint; joint = joint.GetNext()) {
                                    if (Date.now() - joint.creationTime >= JOINT_LIFETIME_MS) {
                                        this.m_world.DestroyJoint(joint);
                                    }
                                }

                                const BODY_LIFETIME_MS =200000;  

                                for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                                    const userData = body.GetUserData();
                                    if (userData && Date.now() - userData.creationTime >= BODY_LIFETIME_MS) {
                                        this.m_world.DestroyBody(body);
                                    }
                                }

        
                            }


                        }     
                    }
                    download_data() {
                        const header = 'time\tx\ty\tangle\tlength\tID';
                        const dataRows = this.bodies_params.map(d => `${d.time}\t${d.x}\t${d.y}\t${d.angle}\t${d.length}\t${d.tag}`);
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
                    static Create() {
                        return new Pyramid();
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
                        let bodyDef = new b2.BodyDef();
                        let body = this.m_world.CreateBody(bodyDef);
                        let edge = new b2.EdgeShape();
                        edge.SetTwoSided(vec1, vec2);
                        body.CreateFixture(edge, 0);
                    }
                    createTriangleBody(x, y, vertices) {
                        let triangleBodyDef = new b2.BodyDef();
                        triangleBodyDef.position.Set(x, y);
                        let triangleBody = this.m_world.CreateBody(triangleBodyDef);
                        let triangleShape = new b2.PolygonShape();
                        triangleShape.Set(vertices, 3);
                        triangleBody.CreateFixture(triangleShape, 0);
                    }
                    createTrianglesx(count, ...vecs) {
                        for(let i = 0; i < count; i++) {
                            vecs.forEach(vec => this.createTriangleBody(i * 5, 0, vec));
                        }
                    }
                    createTrianglesy(count, ...vecs) {
                        for(let i = 0; i < count; i++) {
                            vecs.forEach(vec => this.createTriangleBody(0, i * 5, vec));
                        }
                    }

                    createContainer(...vecs) {
                        vecs.forEach(vec => this.createBody(vec[0], vec[1]));
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
                        const boxFixtureDef = {shape: new b2.PolygonShape().SetAsBox(a, b), density: 0.0001, restitution: 0.0, friction: 0};
                        body.CreateFixture(boxFixtureDef);
                        const circleShape = new b2.CircleShape(a); 
                        // Set restitution for the circles
                        const circleFixtureDef = {shape: circleShape, density: 0.0001, restitution: 0.0, friction: 0};
                        [-b, b].forEach(dy => {
                            circleShape.m_p.Set(0, dy);
                            body.CreateFixture(circleFixtureDef);
                        });
                        body.growthRate = GROWTH_RATE;
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
                
                };
                exports_1("Pyramid", Pyramid);
                exports_1("testIndex", testIndex = testbed.RegisterTest("Stacking", "Microfluidic Biofilm", Pyramid.Create));
            }
    };
});
