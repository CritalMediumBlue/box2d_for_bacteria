// MIT License
System.register(["@box2d"], function (exports_1, context_1) {
    "use strict";
    var b2, Settings;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (b2_1) {
                b2 = b2_1;
            }
        ],
        execute: function () {
            Settings = class Settings {
                constructor() {
                    this.m_testIndex = 0;
                    this.m_windowWidth = 1600;
                    this.m_windowHeight = 900;
                    this.m_hertz = 60;
                    this.m_velocityIterations = 20;
                    this.m_positionIterations = 20;
                    // #if B2_ENABLE_PARTICLE
                    // Particle iterations are needed for numerical stability in particle
                    // simulations with small particles and relatively high gravity.
                    // b2CalculateParticleIterations helps to determine the number.
                    this.m_particleIterations = 10;
                    // #endif
                    this.m_drawShapes = true;
                    // #if B2_ENABLE_PARTICLE
                    this.m_drawParticles = false;
                    // #endif
                    this.m_drawJoints = true;
                    this.m_drawAABBs = false;
                    this.m_drawContactPoints = false;
                    this.m_drawContactNormals = false;
                    this.m_drawContactImpulse = false;
                    this.m_drawFrictionImpulse = false;
                    this.m_drawCOMs = false;
                    this.m_drawControllers = false;
                    this.m_drawStats = false;
                    this.m_drawProfile = false;
                    this.m_enableWarmStarting = true;
                    this.m_enableContinuous = false;
                    this.m_enableSubStepping = false;
                    this.m_enableSleep = false;
                    this.m_pause = false;
                    this.m_singleStep = false;
                    // #if B2_ENABLE_PARTICLE
                    this.m_strictContacts = false;
                }
                // #endif
                Reset() {
                    this.m_testIndex = 0;
                    this.m_windowWidth = 1600;
                    this.m_windowHeight = 900;
                    this.m_hertz = 4;
                    this.m_velocityIterations = 2;
                    this.m_positionIterations = 2;
                    // #if B2_ENABLE_PARTICLE
                    // Particle iterations are needed for numerical stability in particle
                    // simulations with small particles and relatively high gravity.
                    // b2CalculateParticleIterations helps to determine the number.
                    this.m_particleIterations = b2.CalculateParticleIterations(10, 0.04, 1 / this.m_hertz);
                    // #endif
                    this.m_drawShapes = true;
                    // #if B2_ENABLE_PARTICLE
                    this.m_drawParticles = true;
                    // #endif
                    this.m_drawJoints = true;
                    this.m_drawAABBs = false;
                    this.m_drawContactPoints = false;
                    this.m_drawContactNormals = false;
                    this.m_drawContactImpulse = false;
                    this.m_drawFrictionImpulse = false;
                    this.m_drawCOMs = false;
                    // #if B2_ENABLE_CONTROLLER
                    this.m_drawControllers = true;
                    // #endif
                    this.m_drawStats = true;
                    this.m_drawProfile = true;
                    this.m_enableWarmStarting = true;
                    this.m_enableContinuous = false;
                    this.m_enableSubStepping = false;
                    this.m_enableSleep = false;
                    this.m_pause = false;
                    this.m_singleStep = false;
                    // #if B2_ENABLE_PARTICLE
                    this.m_strictContacts = false;
                    // #endif
                }
                Save() { }
                Load() { }
            };
            exports_1("Settings", Settings);
        }
    };
});
//# sourceMappingURL=settings.js.map