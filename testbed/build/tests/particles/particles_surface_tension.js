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
System.register(["@box2d", "@testbed"], function (exports_1, context_1) {
    "use strict";
    var b2, testbed, ParticlesSurfaceTension, testIndex;
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
            ParticlesSurfaceTension = class ParticlesSurfaceTension extends testbed.Test {
                constructor() {
                    super(); // base class constructor
         

                    {
                        this.m_world.SetGravity(new b2.Vec2(0, 0));
                    }
                    this.m_particleSystem.SetRadius(0.035 * 20); 
                    this.time_step=0
                    //Let's create a container for the particles. We need 2 walls, a bottom and a roof
                    //Let's create them as static lines

                                // Create the ground body
                                let groundBodyDef = new b2.BodyDef();
                                let groundBody = this.m_world.CreateBody(groundBodyDef);
                                let groundEdge = new b2.EdgeShape();
                                groundEdge.SetTwoSided(new b2.Vec2(-200, 100), new b2.Vec2(200, 100));
                                groundBody.CreateFixture(groundEdge, 0);

                                // Create the roof body
                                let roofBodyDef = new b2.BodyDef();
                                let roofBody = this.m_world.CreateBody(roofBodyDef);
                                let roofEdge = new b2.EdgeShape();
                                roofEdge.SetTwoSided(new b2.Vec2(-200, -100), new b2.Vec2(200, -100));
                                roofBody.CreateFixture(roofEdge, 0);
            
                                // Create the wall body
                                let wallBodyDef = new b2.BodyDef();
                                let wallBody = this.m_world.CreateBody(wallBodyDef);
                                let wallEdge = new b2.EdgeShape();
                                wallEdge.SetTwoSided(new b2.Vec2(200, 100), new b2.Vec2(200, -100));
                                wallBody.CreateFixture(wallEdge, 0);
            
                                // Create the wall body
                                let wallBodyDef2 = new b2.BodyDef();
                                let wallBody2 = this.m_world.CreateBody(wallBodyDef2);
                                let wallEdge2 = new b2.EdgeShape();
                                wallEdge2.SetTwoSided(new b2.Vec2(-200, 100), new b2.Vec2(-200, -100));
                                wallBody2.CreateFixture(wallEdge2, 0);




{
    const shape = new b2.CircleShape();
    shape.m_radius = 5; // set the radius of the circle
    const pd = new b2.ParticleGroupDef();
    pd.flags = b2.ParticleFlag.b2_colorMixingParticle | b2.ParticleFlag.b2_viscousParticle | b2.ParticleFlag.b2_tensileParticle | b2.ParticleFlag.b2_powderParticle;
    pd.shape = shape;
    let rand= 0;
    pd.color.Set(rand, -1000, 1-rand, 1);
    this.m_particleSystem.CreateParticleGroup(pd);

}
              

                }
                Step(settings) {
                    this.time_step+=1;  
                   // console.log(this.time_step);

                    super.Step(settings);

                    const particleCount = this.m_particleSystem.GetParticleCount();
                    if (this.time_step >100) {
                    for (let i = 0; i < particleCount; i++) {
                        // Get the colors of all particles
                        const colors = this.m_particleSystem.GetColorBuffer();

                        // Get the color of the particle i
                        const color = colors[i];

                        // If the blue component of the color is greater than 0.1, then apply a random force to the particle
                        if (color.r > 0.25) {
                            const f = new b2.Vec2((Math.cos(color.g)) * 2000, (Math.sin(color.g) ) * 2000);
                            this.m_particleSystem.ParticleApplyForce(i, f);
                        } else if (Math.random() < 0.7){
                            // Get the velocities of all particles
                            const velocities = this.m_particleSystem.GetVelocityBuffer();
                            // set velocity of particle i to 0

                            velocities[i].Set(0, 0);

                        }
                    }
                }
                }
                static Create() {
                    return new ParticlesSurfaceTension();
                }
            };
            exports_1("ParticlesSurfaceTension", ParticlesSurfaceTension);
            exports_1("testIndex", testIndex = testbed.RegisterTest("Particles", "Surface Tension", ParticlesSurfaceTension.Create));
        }
    };
});
//# sourceMappingURL=particles_surface_tension.js.map