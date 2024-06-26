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
                    
                    this.dynamicBodyCount = 0;
                    for (let i = 0; i < 100; ++i) {
                        if (i == 0) {
                            this.createBacteria(this.m_world, new b2.Vec2(0.0, 0.0), 7*Math.PI/4 ,Math.random() * (12 - 6) + 6,new b2.Color(0.5, 0.5, 0.5), 200.3932, 0, 0.9705701, "first", 0.1);
                            this.dynamicBodyCount++;
                        }else {
                        this.createBacteria(this.m_world, new b2.Vec2(0.0, 0.0), 7*Math.PI/4 ,Math.random() * (12 - 6) + 6,new b2.Color(0.5, 0.5, 0.5), 200.3932, 0, 0.9705701, "none", 0.1);
                        this.dynamicBodyCount++;
                        }
                    }
                    this.createGrid(); // Create the grid for the concentration
                    this.time_step = 0;
                    this.stopGrowing = false;
                    this.startGrowing = false;
                    this.data=[];
                }


                createGrid() {
                    // Initialize 2D tensors filled with zeros
                    this.concentration = tf.zeros([45, 45]).arraySync();
                    this.concentration2 = tf.zeros([45, 45]).arraySync();
                    const kernel1D = tf.tensor1d([1/4, 2/4, 1/4]);
                    this.kernelTensorX = tf.reshape(kernel1D, [1, 3, 1, 1]);
                    this.kernelTensorY = tf.reshape(kernel1D, [3, 1, 1, 1]);
                }




                createBacteria(world, position, angle, length, myColor, myR, myI, myL, tag) {
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
                    body.growthRate = 1.002+Math.random()*0.001; 
                    body.reproductiveLength = 8*a+Math.random()*0.1;
                    body.myCustomColor = myColor;
                    body.myR = myR;
                    body.myI = myI;
                    body.myL = myL;
                    body.tag = tag;
                    
                    
                    body.myKA = 100+ (Math.random()-0.5)*10;
                    body.myKR = 110+ (Math.random()-0.5)*10;
                    body.myX_sensor = 100 + (Math.random()-0.5)*100;
                    return body;
                }


                createCoordinates(){
                    let p1 = new b2.Vec2(-200, 200);
                    let p2 = new b2.Vec2(200, 200);
                    let p3 = new b2.Vec2(200, -200);
                    let p4 = new b2.Vec2(-200, -200);
                    let p11 = new b2.Vec2(-220, 220);
                    let p21 = new b2.Vec2(220, 220);
                    let p31 = new b2.Vec2(220, -220);
                    let p41 = new b2.Vec2(-220, -220);
                    let p45 = new b2.Vec2(-220-220, -220);
                    let p51 = new b2.Vec2(-220-220, 220);
                    let p6 = new b2.Vec2(-220-220, 0);
                    let p7 = new b2.Vec2(-220, 0);
                    testbed.g_debugDraw.DrawSegment(p1, p2, new b2.Color(0, 0, 0));
                    testbed.g_debugDraw.DrawSegment(p2, p3, new b2.Color(0, 0, 0)); 
                    testbed.g_debugDraw.DrawSegment(p3, p4, new b2.Color(0, 0, 0));
                    testbed.g_debugDraw.DrawSegment(p4, p1, new b2.Color(0, 0, 0)); 
                    testbed.g_debugDraw.DrawSegment(p11, p21, new b2.Color(0, 0, 0));
                    testbed.g_debugDraw.DrawSegment(p21, p31, new b2.Color(0, 0, 0)); 
                    testbed.g_debugDraw.DrawSegment(p31, p41, new b2.Color(0, 0, 0));
                    testbed.g_debugDraw.DrawSegment(p41, p11, new b2.Color(0, 0, 0));  
                    testbed.g_debugDraw.DrawSegment(p41, p45, new b2.Color(0, 0, 0));   
                    testbed.g_debugDraw.DrawSegment(p11, p51, new b2.Color(0, 0, 0)); 
                    testbed.g_debugDraw.DrawSegment(p45, p51, new b2.Color(0, 0, 0));  
                    testbed.g_debugDraw.DrawSegment(p6, p7, new b2.Color(0, 0, 0));  
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
                        case "s":
                            this.stopGrowing = true;
                            break;
                        case "i":
                            this.startGrowing = true;
                            break;
                        case "d":
                            this.download_data();
                            break;
                    }
                }

                KeyboardUp(key) {
                    switch (key) {
                        case "s":
                            this.stopGrowing = false;
                            break;
                        case "i":
                            this.startGrowing = false;
                            break;
                    }
                }

                Step(settings) {
                    super.Step(settings);
                    if (!settings.m_pause) {
                        this.time_step += 1;
                        
                        const EveryNFrames = 10;
                        if (this.time_step % EveryNFrames == 0) {
                        for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                            if (body.GetType() === b2.BodyType.b2_dynamicBody) {

                                let originalPosition = body.GetPosition();
                                let discretePosition = new b2.Vec2(Math.round(originalPosition.x/10), Math.round(originalPosition.y/10));
                                this.concentration[22+discretePosition.x][22+discretePosition.y] += 0.1; // or whatever small amount you want to add                                
                                
                                if (body.tag == "surfactin") {
                                    this.concentration2[22+discretePosition.x][22+discretePosition.y] += 1;
                                   }
                               
                                

                            }  
                        }

                        tf.tidy(() => {
                            let concentrationTensor = tf.tensor(this.concentration).reshape([1, 45, 45, 1]); // Convert the concentration to a tensor
                            let concentrationTensor2 = tf.tensor(this.concentration2).reshape([1, 45, 45, 1]); // Convert the concentration to a tensor

                            // Concatenate the tensors along the batch dimension to create a batch
                            let batch = tf.concat([concentrationTensor, concentrationTensor2], 0);

                            let iterations = EveryNFrames*20; // Number of times to apply the convolution  
                            for (let i = 0; i < iterations; i++) {
                                batch = tf.conv2d(batch, this.kernelTensorX, 1, 'same');
                                batch = tf.conv2d(batch, this.kernelTensorY, 1, 'same');
                            }

                            // Split the batch back into individual tensors
                            [this.concentration, this.concentration2] = tf.split(batch, 2, 0);

                            this.concentration = this.concentration.squeeze().arraySync(); // Convert back to array after the loop
                            this.concentration2 = this.concentration2.squeeze().arraySync(); // Convert back to array after the loop
                        });
                        
                       // console.log(this.time_step/EveryNFrames);
                    }
                   
                     
                        let separation = 5*0.97; // The separation between points
                        let size = 14*0.97; // The size of the point
                        for (let i = 0; i <= 44; ++i) {
                            for (let j = 0; j <= 44; ++j) {
                                let color = new b2.Color(1, 0, 1,  this.concentration[i][j] ); // The color depends on the concentration
                                let position = new b2.Vec2(((i)-44*2) * separation-10, ((j)-44) * separation-4);
                                testbed.g_debugDraw.DrawPoint(position, size, color);
                            }
                        }


                        for (let i = 0; i <= 44; ++i) {
                            for (let j = 0; j <= 44; ++j) {
                                let color = new b2.Color(0, 1, 0,  this.concentration2[i][j] ); // The color depends on the concentration
                                let position = new b2.Vec2(((i)-44*2) * separation-10, ((j)) * separation+4);
                                testbed.g_debugDraw.DrawPoint(position, size, color);
                            }
                        }
                        

                        this.createCoordinates();





                        if (this.stopGrowing == true) {
                            for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                                if (body.GetType() === b2.BodyType.b2_dynamicBody) {
                                        body.growthRate = 1;

                                }
                            }
                            console.log("They're no longer growing");
                        }

                        if (this.startGrowing == true) {

                        
                            for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                                if (body.GetType() === b2.BodyType.b2_dynamicBody) {

                                    
                                    body.growthRate = 1.005+Math.random()*0.001;

                                }
                            }
                            console.log("They're growing");
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
                                    //let discretePosition = new b2.Vec2(Math.round(originalPosition.x/10), Math.round(originalPosition.y/10));

                                    //let senseConcentration = this.concentration[22+discretePosition.x][22+discretePosition.y];

                                    
                                    if (length >= body.reproductiveLength) {
                                        let a=6*(1/4);
                                        let originalAngle = body.GetAngle();
                                        let factor = (1/4)*length+(a/2);
                                        let factor2 = (length-(2*a))/2;
                                        let offset = new b2.Vec2(-factor * Math.sin(originalAngle), factor * Math.cos(originalAngle));
                                        let newPosition1 = new b2.Vec2(originalPosition.x - offset.x, originalPosition.y - offset.y);
                                        let newPosition2 = new b2.Vec2(originalPosition.x + offset.x, originalPosition.y + offset.y);
                                        let newTag1;
                                        let newTag2;
                                        if(body.tag == "first") {
                                            newTag1 = "first";
                                            newTag2 = "none";
                                        } else {
                                            newTag1 = "none";
                                            newTag2 = "none";
                                        }
                                        this.createBacteria(this.m_world, newPosition1, originalAngle, factor2, body.myCustomColor, body.myR, body.myI, body.myL, newTag1);
                                        this.createBacteria(this.m_world, newPosition2, originalAngle, factor2, body.myCustomColor, body.myR, body.myI, body.myL , newTag2);
                                        
                                        this.dynamicBodyCount++;
                                        this.dynamicBodyCount++;



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

                                    // get discrete position
                                    // produce substance
                                    //this.concentration[22+discretePosition.x][22+discretePosition.y] =+ 0;
                                    
                               


                        
                            }
                           
                        }


  


 
                        let prod = 3.0; // (3.33 minutes^-1 acc to Zhuo Chen) 1 (0.84 minutes^-1 acc to Shristopher A. Voigt) (0.84 acc to Jennifer S. Hallinan
                        let prod_L =2.5;
                        let deg = 1.4e-2;  //  (3.33e-3 1/minute acc to Zhuo Chen) 1 (0.12 1/minute acc to Shristopher A. Voigt)
                        let for_com =  1e-3; //  (5.33e-3 molecules^-1*min^-1 acc to Zhuo Chen)1 (9.06e-3 molecules^-1*min^-1 acc to Joseph A. Newman)
                        let n_R = 4; 
                        

                        
                      if (this.time_step % EveryNFrames*2 == 0) {
                        for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                            if (body.GetType() === b2.BodyType.b2_dynamicBody && body.tag != "surfactin") {


                                let originalPosition = body.GetPosition();

                                let discretePosition = new b2.Vec2(Math.round(originalPosition.x/10), Math.round(originalPosition.y/10));
                                let multiplicationFactor = 100; 
                                // 100 works fine. It eventually transitions to a Low R state.
                                // 200 is works 
                                let Spo0A =  multiplicationFactor*this.concentration2[22+discretePosition.x][22+discretePosition.y];
                                let ComX =  multiplicationFactor*this.concentration[22+discretePosition.x][22+discretePosition.y];
                                let activation_L = 1 / (1 + Math.pow(body.myR / body.myKR, n_R));
                                
                                let activation_P1 = activation_L * Math.pow(Spo0A / body.myKA, n_R) / (1 + Math.pow(Spo0A / body.myKA, n_R));
                            
                    
                                let dR = prod                 - deg * body.myR - for_com * body.myR * body.myI - for_com * body.myR * body.myL; 
                                let dI = prod  *activation_P1 - deg * body.myI - for_com * body.myR * body.myI;
                                let dL = prod_L*activation_L  - deg * body.myL - for_com * body.myR * body.myL;
                               // let dS = prod  *activation_PX - deg * body.myS*0.1;
                    
                                body.myR += dR*9.1;
                                body.myI += dI*9.1;
                                body.myL += dL*9.1;
                               // body.myS += dS*9.1;
                    
                                let R = body.myR;
                                let I = body.myI;
                                let L = body.myL;
                               // let S = body.myS;
                    
                                body.myCustomColor = new b2.Color(Math.abs(R*0.00543-0.087), I*0.0111, L*0.0125);
                                if (ComX > body.myX_sensor && R > 100){
                                    body.myCustomColor = new b2.Color(0, 1, 0);
                                    body.tag = "surfactin";
                                    body.growthRate=1;
                                    
                                } 
                    
                                 if (body.tag == "first") {
                                    console.log("R: " + R + " I: " + I + " L: " + L + " Spo0A: "+Spo0A+" ComX: "+ComX);
                                    body.myCustomColor = new b2.Color(0.1, 0.2, 0.02);
                                } 
                            }
                        }
                        //console.log(this.time_step/EveryMFrames);
                    } 

                 


                        
    

                    

                   
                    for (let body = this.m_world.GetBodyList(); body; body = body.GetNext()) {
                        if (body.GetType() === b2.BodyType.b2_dynamicBody) { 
                            let originalPosition = body.GetPosition();
                            if (originalPosition.x < -200 || originalPosition.x > 200 || originalPosition.y < -200 || originalPosition.y >200) {
                                body.userData = { destroy: true };
                            }
                            if (body.userData && body.userData.destroy) {
                                this.m_world.DestroyBody(body);
                                this.dynamicBodyCount--;

                            }
                        }
                    }
                    this.data.push({bodyCount: this.dynamicBodyCount, timeStep: this.time_step});

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
