// MIT License
System.register(["@box2d", "@testbed"], function (exports_1, context_1) {
    "use strict";
    var b2, testbed, Pyramid, testIndex;
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
            
            Pyramid = class Pyramid extends testbed.Test {
                
                constructor() {

                    super();
                    this.m_world.SetGravity(new b2.Vec2(0, 0));


                    for (let i = 0; i < 1; ++i) {
                        this.createBacteria(this.m_world, new b2.Vec2(0.0, 0.0), 7*Math.PI/4 ,6,new b2.Color(0.5, 0.5, 0.5));
                    }
                }
                createBacteria(world, position, angle, length, myColor) {
                    const bd = new b2.BodyDef();
                    bd.type = b2.BodyType.b2_dynamicBody;
                    bd.position.Set(position.x, position.y);
                    bd.angle = angle; 
                    const body = world.CreateBody(bd);
                    let a = 6*(1/4); 
                    let b = length/2; 

                    // Set restitution for the box
                    const boxFixtureDef = {shape: new b2.PolygonShape().SetAsBox(a, b), density: 0.001, restitution: 1, friction: 0};
                    body.CreateFixture(boxFixtureDef);

                    const circleShape = new b2.CircleShape(a); 

                    // Set restitution for the circles
                    const circleFixtureDef = {shape: circleShape, density: 0.001, restitution: 1.0, friction: 0};
                    [-b, b].forEach(dy => {
                        circleShape.m_p.Set(0, dy);
                        body.CreateFixture(circleFixtureDef);
                    });

                    body.growthRate = 1.001+Math.random()*0.001; 
                    body.reproductiveLength = 8*a+Math.random()*0.1;
                    body.myCustomColor = myColor;
                    return body;
                }
                Step(settings) {
                    
                    super.Step(settings);
                    if (!settings.m_pause) {

                        let size = 20.0; // The size of the point
                        let color = new b2.Color(1, 0, 0, 0.5); // The color of the point (red in this case)
                        let separation = 30; // The separation between points

                        for (let i = -25; i < 25; ++i) {
                            for (let j = -25; j < 25; ++j) {
                                let position = new b2.Vec2(i * separation, j * separation);
                                testbed.g_debugDraw.DrawPoint(position, size, color);
                            }
                        }
                    
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
                                        let a=6*(1/4);
                                        let originalAngle = body.GetAngle();
                                        let factor = (1/4)*length+(a/2);
                                        let factor2 = (length-(2*a))/2;
                                        let offset = new b2.Vec2(-factor * Math.sin(originalAngle), factor * Math.cos(originalAngle));
                                        let newPosition1 = new b2.Vec2(originalPosition.x - offset.x, originalPosition.y - offset.y);
                                        let newPosition2 = new b2.Vec2(originalPosition.x + offset.x, originalPosition.y + offset.y);
                                        let newColor1 = new b2.Color(
                                            (body.myCustomColor.r + (Math.random() - 0.5) * 0.1) % 1,//0.01 is too small
                                            (body.myCustomColor.g + (Math.random() - 0.5) * 0.1) % 1,//0.01 is too small
                                            (body.myCustomColor.b + (Math.random() - 0.5) * 0.1) % 1//0.01 is too small
                                        );
                                        let newColor2 = new b2.Color(
                                            (body.myCustomColor.r + (Math.random() - 0.5) * 0.1) % 1,//0.01 is too small
                                            (body.myCustomColor.g + (Math.random() - 0.5) * 0.1) % 1,//0.01 is too small
                                            (body.myCustomColor.b + (Math.random() - 0.5) * 0.1) % 1//0.01 is too small
                                        );
                                        this.createBacteria(this.m_world, newPosition1, originalAngle, factor2, newColor1);
                                        this.createBacteria(this.m_world, newPosition2, originalAngle, factor2, newColor2);
                                        body.userData = { destroy: true };
                                    }
                                

                                    let angularVelocity = (Math.random() - 0.5) * 0.5;
                                    body.SetAngularVelocity(angularVelocity);

                                    let velocity = body.GetLinearVelocity();
                                    // Calculate the air resistance force
                                    let dragForce = velocity.Clone();
                                    dragForce.SelfNeg();
                                    dragForce.SelfMul(0.01);

                                    // Apply the air resistance force to the body
                                    body.ApplyForceToCenter(dragForce, true);

                                
                                    


                                    if (originalPosition.x < -200 || originalPosition.x > 200 || originalPosition.y < -200 || originalPosition.y >200) {
                                        body.userData = { destroy: true };
                                    }
                                    if (body.userData && body.userData.destroy) {
                                        this.m_world.DestroyBody(body);
                                    }
                            }
                           
                        }

                  

                    }
                   
                }
                static Create() {
                    return new Pyramid();
                    
                }
            };
            exports_1("Pyramid", Pyramid);
            exports_1("testIndex", testIndex = testbed.RegisterTest("Stacking", "Monolayer Biofilm", Pyramid.Create));
        }
    };
});
