/*
* Copyright (c) 2006-2009 Erin Catto http://www.box2d.org
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
System.register(["../Framework/Test", "./Car", "./MotorJoint2", "./RayCast", "./SphereStack", "./ElasticParticles", "./Faucet", "./ParticlesSurfaceTension", "./Sparky"], function (exports_1, context_1) {
    var __moduleName = context_1 && context_1.id;
    var Test_1, Car_1, MotorJoint2_1, RayCast_1, SphereStack_1, ElasticParticles_1, Faucet_1, ParticlesSurfaceTension_1, Sparky_1, g_testEntries;
    return {
        setters: [
            function (Test_1_1) {
                Test_1 = Test_1_1;
            },
            function (Car_1_1) {
                Car_1 = Car_1_1;
            },
            function (MotorJoint2_1_1) {
                MotorJoint2_1 = MotorJoint2_1_1;
            },
            function (RayCast_1_1) {
                RayCast_1 = RayCast_1_1;
            },
            function (SphereStack_1_1) {
                SphereStack_1 = SphereStack_1_1;
            },
            function (ElasticParticles_1_1) {
                ElasticParticles_1 = ElasticParticles_1_1;
            },
            function (Faucet_1_1) {
                Faucet_1 = Faucet_1_1;
            },
            function (ParticlesSurfaceTension_1_1) {
                ParticlesSurfaceTension_1 = ParticlesSurfaceTension_1_1;
            },
            function (Sparky_1_1) {
                Sparky_1 = Sparky_1_1;
            }
        ],
        execute: function () {/*
            * Copyright (c) 2006-2009 Erin Catto http://www.box2d.org
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
            ///#endif
            exports_1("g_testEntries", g_testEntries = [
                ///#if B2_ENABLE_PARTICLE
                new Test_1.TestEntry("Faucet", Faucet_1.Faucet.Create),
                new Test_1.TestEntry("Surface Tension", ParticlesSurfaceTension_1.ParticlesSurfaceTension.Create),
                new Test_1.TestEntry("Elastic Particles", ElasticParticles_1.ElasticParticles.Create),
                new Test_1.TestEntry("Sparky", Sparky_1.Sparky.Create),
                ///#endif
                ///new TestEntry("Continuous Test", ContinuousTest.Create),
                ///new TestEntry("Time of Impact", TimeOfImpact.Create),
                ///new TestEntry("Motor Joint", MotorJoint.Create),
                new Test_1.TestEntry("Motor Joint (Bug #487)", MotorJoint2_1.MotorJoint2.Create),
                ///new TestEntry("Mobile", Mobile.Create),
                ///new TestEntry("MobileBalanced", MobileBalanced.Create),
                ///new TestEntry("Ray-Cast", RayCast.Create),
                new Test_1.TestEntry("Ray-Cast", RayCast_1.RayCast.Create),
                ///new TestEntry("Conveyor Belt", ConveyorBelt.Create),
                ///new TestEntry("Gears", Gears.Create),
                ///new TestEntry("Convex Hull", ConvexHull.Create),
                ///new TestEntry("constying Restitution", constyingRestitution.Create),
                ///new TestEntry("Tumbler", Tumbler.Create),
                ///new TestEntry("Tiles", Tiles.Create),
                ///new TestEntry("Dump Shell", DumpShell.Create),
                ///new TestEntry("Cantilever", Cantilever.Create),
                ///new TestEntry("Character Collision", CharacterCollision.Create),
                ///new TestEntry("Edge Test", EdgeTest.Create),
                ///new TestEntry("Body Types", BodyTypes.Create),
                ///new TestEntry("Shape Editing", ShapeEditing.Create),
                new Test_1.TestEntry("Car", Car_1.Car.Create),
                ///new TestEntry("Apply Force", ApplyForce.Create),
                ///new TestEntry("Prismatic", Prismatic.Create),
                ///new TestEntry("Vertical Stack", VerticalStack.Create),
                new Test_1.TestEntry("SphereStack", SphereStack_1.SphereStack.Create),
            ]);
        }
    };
});
