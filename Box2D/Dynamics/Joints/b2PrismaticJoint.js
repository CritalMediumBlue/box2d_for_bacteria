/*
* Copyright (c) 2006-2011 Erin Catto http://www.box2d.org
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
System.register(["../../Common/b2Settings.js", "../../Common/b2Math.js", "./b2Joint.js"], function (exports_1, context_1) {
    "use strict";
    var b2Settings_js_1, b2Math_js_1, b2Joint_js_1, b2PrismaticJointDef, b2PrismaticJoint;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (b2Settings_js_1_1) {
                b2Settings_js_1 = b2Settings_js_1_1;
            },
            function (b2Math_js_1_1) {
                b2Math_js_1 = b2Math_js_1_1;
            },
            function (b2Joint_js_1_1) {
                b2Joint_js_1 = b2Joint_js_1_1;
            }
        ],
        execute: function () {
            /// Prismatic joint definition. This requires defining a line of
            /// motion using an axis and an anchor point. The definition uses local
            /// anchor points and a local axis so that the initial configuration
            /// can violate the constraint slightly. The joint translation is zero
            /// when the local anchor points coincide in world space. Using local
            /// anchors and a local axis helps when saving and loading a game.
            b2PrismaticJointDef = class b2PrismaticJointDef extends b2Joint_js_1.b2JointDef {
                constructor() {
                    super(b2Joint_js_1.b2JointType.e_prismaticJoint);
                    this.localAnchorA = new b2Math_js_1.b2Vec2();
                    this.localAnchorB = new b2Math_js_1.b2Vec2();
                    this.localAxisA = new b2Math_js_1.b2Vec2(1, 0);
                    this.referenceAngle = 0;
                    this.enableLimit = false;
                    this.lowerTranslation = 0;
                    this.upperTranslation = 0;
                    this.enableMotor = false;
                    this.maxMotorForce = 0;
                    this.motorSpeed = 0;
                }
                Initialize(bA, bB, anchor, axis) {
                    this.bodyA = bA;
                    this.bodyB = bB;
                    this.bodyA.GetLocalPoint(anchor, this.localAnchorA);
                    this.bodyB.GetLocalPoint(anchor, this.localAnchorB);
                    this.bodyA.GetLocalVector(axis, this.localAxisA);
                    this.referenceAngle = this.bodyB.GetAngle() - this.bodyA.GetAngle();
                }
            };
            exports_1("b2PrismaticJointDef", b2PrismaticJointDef);
            b2PrismaticJoint = class b2PrismaticJoint extends b2Joint_js_1.b2Joint {
                constructor(def) {
                    super(def);
                    // Solver shared
                    this.m_localAnchorA = new b2Math_js_1.b2Vec2();
                    this.m_localAnchorB = new b2Math_js_1.b2Vec2();
                    this.m_localXAxisA = new b2Math_js_1.b2Vec2();
                    this.m_localYAxisA = new b2Math_js_1.b2Vec2();
                    this.m_referenceAngle = 0;
                    this.m_impulse = new b2Math_js_1.b2Vec3(0, 0, 0);
                    this.m_motorImpulse = 0;
                    this.m_lowerTranslation = 0;
                    this.m_upperTranslation = 0;
                    this.m_maxMotorForce = 0;
                    this.m_motorSpeed = 0;
                    this.m_enableLimit = false;
                    this.m_enableMotor = false;
                    this.m_limitState = b2Joint_js_1.b2LimitState.e_inactiveLimit;
                    // Solver temp
                    this.m_indexA = 0;
                    this.m_indexB = 0;
                    this.m_localCenterA = new b2Math_js_1.b2Vec2();
                    this.m_localCenterB = new b2Math_js_1.b2Vec2();
                    this.m_invMassA = 0;
                    this.m_invMassB = 0;
                    this.m_invIA = 0;
                    this.m_invIB = 0;
                    this.m_axis = new b2Math_js_1.b2Vec2(0, 0);
                    this.m_perp = new b2Math_js_1.b2Vec2(0, 0);
                    this.m_s1 = 0;
                    this.m_s2 = 0;
                    this.m_a1 = 0;
                    this.m_a2 = 0;
                    this.m_K = new b2Math_js_1.b2Mat33();
                    this.m_K3 = new b2Math_js_1.b2Mat33();
                    this.m_K2 = new b2Math_js_1.b2Mat22();
                    this.m_motorMass = 0;
                    this.m_qA = new b2Math_js_1.b2Rot();
                    this.m_qB = new b2Math_js_1.b2Rot();
                    this.m_lalcA = new b2Math_js_1.b2Vec2();
                    this.m_lalcB = new b2Math_js_1.b2Vec2();
                    this.m_rA = new b2Math_js_1.b2Vec2();
                    this.m_rB = new b2Math_js_1.b2Vec2();
                    this.m_localAnchorA.Copy(b2Settings_js_1.b2Maybe(def.localAnchorA, b2Math_js_1.b2Vec2.ZERO));
                    this.m_localAnchorB.Copy(b2Settings_js_1.b2Maybe(def.localAnchorB, b2Math_js_1.b2Vec2.ZERO));
                    this.m_localXAxisA.Copy(b2Settings_js_1.b2Maybe(def.localAxisA, new b2Math_js_1.b2Vec2(1, 0))).SelfNormalize();
                    b2Math_js_1.b2Vec2.CrossOneV(this.m_localXAxisA, this.m_localYAxisA);
                    this.m_referenceAngle = b2Settings_js_1.b2Maybe(def.referenceAngle, 0);
                    this.m_lowerTranslation = b2Settings_js_1.b2Maybe(def.lowerTranslation, 0);
                    this.m_upperTranslation = b2Settings_js_1.b2Maybe(def.upperTranslation, 0);
                    this.m_maxMotorForce = b2Settings_js_1.b2Maybe(def.maxMotorForce, 0);
                    this.m_motorSpeed = b2Settings_js_1.b2Maybe(def.motorSpeed, 0);
                    this.m_enableLimit = b2Settings_js_1.b2Maybe(def.enableLimit, false);
                    this.m_enableMotor = b2Settings_js_1.b2Maybe(def.enableMotor, false);
                }
                InitVelocityConstraints(data) {
                    this.m_indexA = this.m_bodyA.m_islandIndex;
                    this.m_indexB = this.m_bodyB.m_islandIndex;
                    this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);
                    this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);
                    this.m_invMassA = this.m_bodyA.m_invMass;
                    this.m_invMassB = this.m_bodyB.m_invMass;
                    this.m_invIA = this.m_bodyA.m_invI;
                    this.m_invIB = this.m_bodyB.m_invI;
                    const cA = data.positions[this.m_indexA].c;
                    const aA = data.positions[this.m_indexA].a;
                    const vA = data.velocities[this.m_indexA].v;
                    let wA = data.velocities[this.m_indexA].w;
                    const cB = data.positions[this.m_indexB].c;
                    const aB = data.positions[this.m_indexB].a;
                    const vB = data.velocities[this.m_indexB].v;
                    let wB = data.velocities[this.m_indexB].w;
                    const qA = this.m_qA.SetAngle(aA), qB = this.m_qB.SetAngle(aB);
                    // Compute the effective masses.
                    // b2Vec2 rA = b2Mul(qA, m_localAnchorA - m_localCenterA);
                    b2Math_js_1.b2Vec2.SubVV(this.m_localAnchorA, this.m_localCenterA, this.m_lalcA);
                    const rA = b2Math_js_1.b2Rot.MulRV(qA, this.m_lalcA, this.m_rA);
                    // b2Vec2 rB = b2Mul(qB, m_localAnchorB - m_localCenterB);
                    b2Math_js_1.b2Vec2.SubVV(this.m_localAnchorB, this.m_localCenterB, this.m_lalcB);
                    const rB = b2Math_js_1.b2Rot.MulRV(qB, this.m_lalcB, this.m_rB);
                    // b2Vec2 d = (cB - cA) + rB - rA;
                    const d = b2Math_js_1.b2Vec2.AddVV(b2Math_js_1.b2Vec2.SubVV(cB, cA, b2Math_js_1.b2Vec2.s_t0), b2Math_js_1.b2Vec2.SubVV(rB, rA, b2Math_js_1.b2Vec2.s_t1), b2PrismaticJoint.InitVelocityConstraints_s_d);
                    const mA = this.m_invMassA, mB = this.m_invMassB;
                    const iA = this.m_invIA, iB = this.m_invIB;
                    // Compute motor Jacobian and effective mass.
                    {
                        // m_axis = b2Mul(qA, m_localXAxisA);
                        b2Math_js_1.b2Rot.MulRV(qA, this.m_localXAxisA, this.m_axis);
                        // m_a1 = b2Cross(d + rA, m_axis);
                        this.m_a1 = b2Math_js_1.b2Vec2.CrossVV(b2Math_js_1.b2Vec2.AddVV(d, rA, b2Math_js_1.b2Vec2.s_t0), this.m_axis);
                        // m_a2 = b2Cross(rB, m_axis);
                        this.m_a2 = b2Math_js_1.b2Vec2.CrossVV(rB, this.m_axis);
                        this.m_motorMass = mA + mB + iA * this.m_a1 * this.m_a1 + iB * this.m_a2 * this.m_a2;
                        if (this.m_motorMass > 0) {
                            this.m_motorMass = 1 / this.m_motorMass;
                        }
                    }
                    // Prismatic constraint.
                    {
                        // m_perp = b2Mul(qA, m_localYAxisA);
                        b2Math_js_1.b2Rot.MulRV(qA, this.m_localYAxisA, this.m_perp);
                        // m_s1 = b2Cross(d + rA, m_perp);
                        this.m_s1 = b2Math_js_1.b2Vec2.CrossVV(b2Math_js_1.b2Vec2.AddVV(d, rA, b2Math_js_1.b2Vec2.s_t0), this.m_perp);
                        // m_s2 = b2Cross(rB, m_perp);
                        this.m_s2 = b2Math_js_1.b2Vec2.CrossVV(rB, this.m_perp);
                        // float32 k11 = mA + mB + iA * m_s1 * m_s1 + iB * m_s2 * m_s2;
                        this.m_K.ex.x = mA + mB + iA * this.m_s1 * this.m_s1 + iB * this.m_s2 * this.m_s2;
                        // float32 k12 = iA * m_s1 + iB * m_s2;
                        this.m_K.ex.y = iA * this.m_s1 + iB * this.m_s2;
                        // float32 k13 = iA * m_s1 * m_a1 + iB * m_s2 * m_a2;
                        this.m_K.ex.z = iA * this.m_s1 * this.m_a1 + iB * this.m_s2 * this.m_a2;
                        this.m_K.ey.x = this.m_K.ex.y;
                        // float32 k22 = iA + iB;
                        this.m_K.ey.y = iA + iB;
                        if (this.m_K.ey.y === 0) {
                            // For bodies with fixed rotation.
                            this.m_K.ey.y = 1;
                        }
                        // float32 k23 = iA * m_a1 + iB * m_a2;
                        this.m_K.ey.z = iA * this.m_a1 + iB * this.m_a2;
                        this.m_K.ez.x = this.m_K.ex.z;
                        this.m_K.ez.y = this.m_K.ey.z;
                        // float32 k33 = mA + mB + iA * m_a1 * m_a1 + iB * m_a2 * m_a2;
                        this.m_K.ez.z = mA + mB + iA * this.m_a1 * this.m_a1 + iB * this.m_a2 * this.m_a2;
                        // m_K.ex.Set(k11, k12, k13);
                        // m_K.ey.Set(k12, k22, k23);
                        // m_K.ez.Set(k13, k23, k33);
                    }
                    // Compute motor and limit terms.
                    if (this.m_enableLimit) {
                        // float32 jointTranslation = b2Dot(m_axis, d);
                        const jointTranslation = b2Math_js_1.b2Vec2.DotVV(this.m_axis, d);
                        if (b2Math_js_1.b2Abs(this.m_upperTranslation - this.m_lowerTranslation) < 2 * b2Settings_js_1.b2_linearSlop) {
                            this.m_limitState = b2Joint_js_1.b2LimitState.e_equalLimits;
                        }
                        else if (jointTranslation <= this.m_lowerTranslation) {
                            if (this.m_limitState !== b2Joint_js_1.b2LimitState.e_atLowerLimit) {
                                this.m_limitState = b2Joint_js_1.b2LimitState.e_atLowerLimit;
                                this.m_impulse.z = 0;
                            }
                        }
                        else if (jointTranslation >= this.m_upperTranslation) {
                            if (this.m_limitState !== b2Joint_js_1.b2LimitState.e_atUpperLimit) {
                                this.m_limitState = b2Joint_js_1.b2LimitState.e_atUpperLimit;
                                this.m_impulse.z = 0;
                            }
                        }
                        else {
                            this.m_limitState = b2Joint_js_1.b2LimitState.e_inactiveLimit;
                            this.m_impulse.z = 0;
                        }
                    }
                    else {
                        this.m_limitState = b2Joint_js_1.b2LimitState.e_inactiveLimit;
                        this.m_impulse.z = 0;
                    }
                    if (!this.m_enableMotor) {
                        this.m_motorImpulse = 0;
                    }
                    if (data.step.warmStarting) {
                        // Account for variable time step.
                        // m_impulse *= data.step.dtRatio;
                        this.m_impulse.SelfMul(data.step.dtRatio);
                        this.m_motorImpulse *= data.step.dtRatio;
                        // b2Vec2 P = m_impulse.x * m_perp + (m_motorImpulse + m_impulse.z) * m_axis;
                        const P = b2Math_js_1.b2Vec2.AddVV(b2Math_js_1.b2Vec2.MulSV(this.m_impulse.x, this.m_perp, b2Math_js_1.b2Vec2.s_t0), b2Math_js_1.b2Vec2.MulSV((this.m_motorImpulse + this.m_impulse.z), this.m_axis, b2Math_js_1.b2Vec2.s_t1), b2PrismaticJoint.InitVelocityConstraints_s_P);
                        // float32 LA = m_impulse.x * m_s1 + m_impulse.y + (m_motorImpulse + m_impulse.z) * m_a1;
                        const LA = this.m_impulse.x * this.m_s1 + this.m_impulse.y + (this.m_motorImpulse + this.m_impulse.z) * this.m_a1;
                        // float32 LB = m_impulse.x * m_s2 + m_impulse.y + (m_motorImpulse + m_impulse.z) * m_a2;
                        const LB = this.m_impulse.x * this.m_s2 + this.m_impulse.y + (this.m_motorImpulse + this.m_impulse.z) * this.m_a2;
                        // vA -= mA * P;
                        vA.SelfMulSub(mA, P);
                        wA -= iA * LA;
                        // vB += mB * P;
                        vB.SelfMulAdd(mB, P);
                        wB += iB * LB;
                    }
                    else {
                        this.m_impulse.SetZero();
                        this.m_motorImpulse = 0;
                    }
                    // data.velocities[this.m_indexA].v = vA;
                    data.velocities[this.m_indexA].w = wA;
                    // data.velocities[this.m_indexB].v = vB;
                    data.velocities[this.m_indexB].w = wB;
                }
                SolveVelocityConstraints(data) {
                    const vA = data.velocities[this.m_indexA].v;
                    let wA = data.velocities[this.m_indexA].w;
                    const vB = data.velocities[this.m_indexB].v;
                    let wB = data.velocities[this.m_indexB].w;
                    const mA = this.m_invMassA, mB = this.m_invMassB;
                    const iA = this.m_invIA, iB = this.m_invIB;
                    // Solve linear motor constraint.
                    if (this.m_enableMotor && this.m_limitState !== b2Joint_js_1.b2LimitState.e_equalLimits) {
                        // float32 Cdot = b2Dot(m_axis, vB - vA) + m_a2 * wB - m_a1 * wA;
                        const Cdot = b2Math_js_1.b2Vec2.DotVV(this.m_axis, b2Math_js_1.b2Vec2.SubVV(vB, vA, b2Math_js_1.b2Vec2.s_t0)) + this.m_a2 * wB - this.m_a1 * wA;
                        let impulse = this.m_motorMass * (this.m_motorSpeed - Cdot);
                        const oldImpulse = this.m_motorImpulse;
                        const maxImpulse = data.step.dt * this.m_maxMotorForce;
                        this.m_motorImpulse = b2Math_js_1.b2Clamp(this.m_motorImpulse + impulse, (-maxImpulse), maxImpulse);
                        impulse = this.m_motorImpulse - oldImpulse;
                        // b2Vec2 P = impulse * m_axis;
                        const P = b2Math_js_1.b2Vec2.MulSV(impulse, this.m_axis, b2PrismaticJoint.SolveVelocityConstraints_s_P);
                        const LA = impulse * this.m_a1;
                        const LB = impulse * this.m_a2;
                        // vA -= mA * P;
                        vA.SelfMulSub(mA, P);
                        wA -= iA * LA;
                        // vB += mB * P;
                        vB.SelfMulAdd(mB, P);
                        wB += iB * LB;
                    }
                    // b2Vec2 Cdot1;
                    // Cdot1.x = b2Dot(m_perp, vB - vA) + m_s2 * wB - m_s1 * wA;
                    const Cdot1_x = b2Math_js_1.b2Vec2.DotVV(this.m_perp, b2Math_js_1.b2Vec2.SubVV(vB, vA, b2Math_js_1.b2Vec2.s_t0)) + this.m_s2 * wB - this.m_s1 * wA;
                    // Cdot1.y = wB - wA;
                    const Cdot1_y = wB - wA;
                    if (this.m_enableLimit && this.m_limitState !== b2Joint_js_1.b2LimitState.e_inactiveLimit) {
                        // Solve prismatic and limit constraint in block form.
                        // float32 Cdot2;
                        // Cdot2 = b2Dot(m_axis, vB - vA) + m_a2 * wB - m_a1 * wA;
                        const Cdot2 = b2Math_js_1.b2Vec2.DotVV(this.m_axis, b2Math_js_1.b2Vec2.SubVV(vB, vA, b2Math_js_1.b2Vec2.s_t0)) + this.m_a2 * wB - this.m_a1 * wA;
                        // b2Vec3 Cdot(Cdot1.x, Cdot1.y, Cdot2);
                        // b2Vec3 f1 = m_impulse;
                        const f1 = b2PrismaticJoint.SolveVelocityConstraints_s_f1.Copy(this.m_impulse);
                        // b2Vec3 df =  m_K.Solve33(-Cdot);
                        const df3 = this.m_K.Solve33((-Cdot1_x), (-Cdot1_y), (-Cdot2), b2PrismaticJoint.SolveVelocityConstraints_s_df3);
                        // m_impulse += df;
                        this.m_impulse.SelfAdd(df3);
                        if (this.m_limitState === b2Joint_js_1.b2LimitState.e_atLowerLimit) {
                            this.m_impulse.z = b2Math_js_1.b2Max(this.m_impulse.z, 0);
                        }
                        else if (this.m_limitState === b2Joint_js_1.b2LimitState.e_atUpperLimit) {
                            this.m_impulse.z = b2Math_js_1.b2Min(this.m_impulse.z, 0);
                        }
                        // f2(1:2) = invK(1:2,1:2) * (-Cdot(1:2) - K(1:2,3) * (f2(3) - f1(3))) + f1(1:2)
                        // b2Vec2 b = -Cdot1 - (m_impulse.z - f1.z) * b2Vec2(m_K.ez.x, m_K.ez.y);
                        const b_x = (-Cdot1_x) - (this.m_impulse.z - f1.z) * this.m_K.ez.x;
                        const b_y = (-Cdot1_y) - (this.m_impulse.z - f1.z) * this.m_K.ez.y;
                        // b2Vec2 f2r = m_K.Solve22(b) + b2Vec2(f1.x, f1.y);
                        const f2r = this.m_K.Solve22(b_x, b_y, b2PrismaticJoint.SolveVelocityConstraints_s_f2r);
                        f2r.x += f1.x;
                        f2r.y += f1.y;
                        // m_impulse.x = f2r.x;
                        this.m_impulse.x = f2r.x;
                        // m_impulse.y = f2r.y;
                        this.m_impulse.y = f2r.y;
                        // df = m_impulse - f1;
                        df3.x = this.m_impulse.x - f1.x;
                        df3.y = this.m_impulse.y - f1.y;
                        df3.z = this.m_impulse.z - f1.z;
                        // b2Vec2 P = df.x * m_perp + df.z * m_axis;
                        const P = b2Math_js_1.b2Vec2.AddVV(b2Math_js_1.b2Vec2.MulSV(df3.x, this.m_perp, b2Math_js_1.b2Vec2.s_t0), b2Math_js_1.b2Vec2.MulSV(df3.z, this.m_axis, b2Math_js_1.b2Vec2.s_t1), b2PrismaticJoint.SolveVelocityConstraints_s_P);
                        // float32 LA = df.x * m_s1 + df.y + df.z * m_a1;
                        const LA = df3.x * this.m_s1 + df3.y + df3.z * this.m_a1;
                        // float32 LB = df.x * m_s2 + df.y + df.z * m_a2;
                        const LB = df3.x * this.m_s2 + df3.y + df3.z * this.m_a2;
                        // vA -= mA * P;
                        vA.SelfMulSub(mA, P);
                        wA -= iA * LA;
                        // vB += mB * P;
                        vB.SelfMulAdd(mB, P);
                        wB += iB * LB;
                    }
                    else {
                        // Limit is inactive, just solve the prismatic constraint in block form.
                        // b2Vec2 df = m_K.Solve22(-Cdot1);
                        const df2 = this.m_K.Solve22((-Cdot1_x), (-Cdot1_y), b2PrismaticJoint.SolveVelocityConstraints_s_df2);
                        this.m_impulse.x += df2.x;
                        this.m_impulse.y += df2.y;
                        // b2Vec2 P = df.x * m_perp;
                        const P = b2Math_js_1.b2Vec2.MulSV(df2.x, this.m_perp, b2PrismaticJoint.SolveVelocityConstraints_s_P);
                        // float32 LA = df.x * m_s1 + df.y;
                        const LA = df2.x * this.m_s1 + df2.y;
                        // float32 LB = df.x * m_s2 + df.y;
                        const LB = df2.x * this.m_s2 + df2.y;
                        // vA -= mA * P;
                        vA.SelfMulSub(mA, P);
                        wA -= iA * LA;
                        // vB += mB * P;
                        vB.SelfMulAdd(mB, P);
                        wB += iB * LB;
                    }
                    // data.velocities[this.m_indexA].v = vA;
                    data.velocities[this.m_indexA].w = wA;
                    // data.velocities[this.m_indexB].v = vB;
                    data.velocities[this.m_indexB].w = wB;
                }
                SolvePositionConstraints(data) {
                    const cA = data.positions[this.m_indexA].c;
                    let aA = data.positions[this.m_indexA].a;
                    const cB = data.positions[this.m_indexB].c;
                    let aB = data.positions[this.m_indexB].a;
                    const qA = this.m_qA.SetAngle(aA), qB = this.m_qB.SetAngle(aB);
                    const mA = this.m_invMassA, mB = this.m_invMassB;
                    const iA = this.m_invIA, iB = this.m_invIB;
                    // b2Vec2 rA = b2Mul(qA, m_localAnchorA - m_localCenterA);
                    const rA = b2Math_js_1.b2Rot.MulRV(qA, this.m_lalcA, this.m_rA);
                    // b2Vec2 rB = b2Mul(qB, m_localAnchorB - m_localCenterB);
                    const rB = b2Math_js_1.b2Rot.MulRV(qB, this.m_lalcB, this.m_rB);
                    // b2Vec2 d = cB + rB - cA - rA;
                    const d = b2Math_js_1.b2Vec2.SubVV(b2Math_js_1.b2Vec2.AddVV(cB, rB, b2Math_js_1.b2Vec2.s_t0), b2Math_js_1.b2Vec2.AddVV(cA, rA, b2Math_js_1.b2Vec2.s_t1), b2PrismaticJoint.SolvePositionConstraints_s_d);
                    // b2Vec2 axis = b2Mul(qA, m_localXAxisA);
                    const axis = b2Math_js_1.b2Rot.MulRV(qA, this.m_localXAxisA, this.m_axis);
                    // float32 a1 = b2Cross(d + rA, axis);
                    const a1 = b2Math_js_1.b2Vec2.CrossVV(b2Math_js_1.b2Vec2.AddVV(d, rA, b2Math_js_1.b2Vec2.s_t0), axis);
                    // float32 a2 = b2Cross(rB, axis);
                    const a2 = b2Math_js_1.b2Vec2.CrossVV(rB, axis);
                    // b2Vec2 perp = b2Mul(qA, m_localYAxisA);
                    const perp = b2Math_js_1.b2Rot.MulRV(qA, this.m_localYAxisA, this.m_perp);
                    // float32 s1 = b2Cross(d + rA, perp);
                    const s1 = b2Math_js_1.b2Vec2.CrossVV(b2Math_js_1.b2Vec2.AddVV(d, rA, b2Math_js_1.b2Vec2.s_t0), perp);
                    // float32 s2 = b2Cross(rB, perp);
                    const s2 = b2Math_js_1.b2Vec2.CrossVV(rB, perp);
                    // b2Vec3 impulse;
                    let impulse = b2PrismaticJoint.SolvePositionConstraints_s_impulse;
                    // b2Vec2 C1;
                    // C1.x = b2Dot(perp, d);
                    const C1_x = b2Math_js_1.b2Vec2.DotVV(perp, d);
                    // C1.y = aB - aA - m_referenceAngle;
                    const C1_y = aB - aA - this.m_referenceAngle;
                    let linearError = b2Math_js_1.b2Abs(C1_x);
                    const angularError = b2Math_js_1.b2Abs(C1_y);
                    let active = false;
                    let C2 = 0;
                    if (this.m_enableLimit) {
                        // float32 translation = b2Dot(axis, d);
                        const translation = b2Math_js_1.b2Vec2.DotVV(axis, d);
                        if (b2Math_js_1.b2Abs(this.m_upperTranslation - this.m_lowerTranslation) < 2 * b2Settings_js_1.b2_linearSlop) {
                            // Prevent large angular corrections
                            C2 = b2Math_js_1.b2Clamp(translation, (-b2Settings_js_1.b2_maxLinearCorrection), b2Settings_js_1.b2_maxLinearCorrection);
                            linearError = b2Math_js_1.b2Max(linearError, b2Math_js_1.b2Abs(translation));
                            active = true;
                        }
                        else if (translation <= this.m_lowerTranslation) {
                            // Prevent large linear corrections and allow some slop.
                            C2 = b2Math_js_1.b2Clamp(translation - this.m_lowerTranslation + b2Settings_js_1.b2_linearSlop, (-b2Settings_js_1.b2_maxLinearCorrection), 0);
                            linearError = b2Math_js_1.b2Max(linearError, this.m_lowerTranslation - translation);
                            active = true;
                        }
                        else if (translation >= this.m_upperTranslation) {
                            // Prevent large linear corrections and allow some slop.
                            C2 = b2Math_js_1.b2Clamp(translation - this.m_upperTranslation - b2Settings_js_1.b2_linearSlop, 0, b2Settings_js_1.b2_maxLinearCorrection);
                            linearError = b2Math_js_1.b2Max(linearError, translation - this.m_upperTranslation);
                            active = true;
                        }
                    }
                    if (active) {
                        // float32 k11 = mA + mB + iA * s1 * s1 + iB * s2 * s2;
                        const k11 = mA + mB + iA * s1 * s1 + iB * s2 * s2;
                        // float32 k12 = iA * s1 + iB * s2;
                        const k12 = iA * s1 + iB * s2;
                        // float32 k13 = iA * s1 * a1 + iB * s2 * a2;
                        const k13 = iA * s1 * a1 + iB * s2 * a2;
                        // float32 k22 = iA + iB;
                        let k22 = iA + iB;
                        if (k22 === 0) {
                            // For fixed rotation
                            k22 = 1;
                        }
                        // float32 k23 = iA * a1 + iB * a2;
                        const k23 = iA * a1 + iB * a2;
                        // float32 k33 = mA + mB + iA * a1 * a1 + iB * a2 * a2;
                        const k33 = mA + mB + iA * a1 * a1 + iB * a2 * a2;
                        // b2Mat33 K;
                        const K = this.m_K3;
                        // K.ex.Set(k11, k12, k13);
                        K.ex.SetXYZ(k11, k12, k13);
                        // K.ey.Set(k12, k22, k23);
                        K.ey.SetXYZ(k12, k22, k23);
                        // K.ez.Set(k13, k23, k33);
                        K.ez.SetXYZ(k13, k23, k33);
                        // b2Vec3 C;
                        // C.x = C1.x;
                        // C.y = C1.y;
                        // C.z = C2;
                        // impulse = K.Solve33(-C);
                        impulse = K.Solve33((-C1_x), (-C1_y), (-C2), impulse);
                    }
                    else {
                        // float32 k11 = mA + mB + iA * s1 * s1 + iB * s2 * s2;
                        const k11 = mA + mB + iA * s1 * s1 + iB * s2 * s2;
                        // float32 k12 = iA * s1 + iB * s2;
                        const k12 = iA * s1 + iB * s2;
                        // float32 k22 = iA + iB;
                        let k22 = iA + iB;
                        if (k22 === 0) {
                            k22 = 1;
                        }
                        // b2Mat22 K;
                        const K2 = this.m_K2;
                        // K.ex.Set(k11, k12);
                        K2.ex.Set(k11, k12);
                        // K.ey.Set(k12, k22);
                        K2.ey.Set(k12, k22);
                        // b2Vec2 impulse1 = K.Solve(-C1);
                        const impulse1 = K2.Solve((-C1_x), (-C1_y), b2PrismaticJoint.SolvePositionConstraints_s_impulse1);
                        impulse.x = impulse1.x;
                        impulse.y = impulse1.y;
                        impulse.z = 0;
                    }
                    // b2Vec2 P = impulse.x * perp + impulse.z * axis;
                    const P = b2Math_js_1.b2Vec2.AddVV(b2Math_js_1.b2Vec2.MulSV(impulse.x, perp, b2Math_js_1.b2Vec2.s_t0), b2Math_js_1.b2Vec2.MulSV(impulse.z, axis, b2Math_js_1.b2Vec2.s_t1), b2PrismaticJoint.SolvePositionConstraints_s_P);
                    // float32 LA = impulse.x * s1 + impulse.y + impulse.z * a1;
                    const LA = impulse.x * s1 + impulse.y + impulse.z * a1;
                    // float32 LB = impulse.x * s2 + impulse.y + impulse.z * a2;
                    const LB = impulse.x * s2 + impulse.y + impulse.z * a2;
                    // cA -= mA * P;
                    cA.SelfMulSub(mA, P);
                    aA -= iA * LA;
                    // cB += mB * P;
                    cB.SelfMulAdd(mB, P);
                    aB += iB * LB;
                    // data.positions[this.m_indexA].c = cA;
                    data.positions[this.m_indexA].a = aA;
                    // data.positions[this.m_indexB].c = cB;
                    data.positions[this.m_indexB].a = aB;
                    return linearError <= b2Settings_js_1.b2_linearSlop && angularError <= b2Settings_js_1.b2_angularSlop;
                }
                GetAnchorA(out) {
                    return this.m_bodyA.GetWorldPoint(this.m_localAnchorA, out);
                }
                GetAnchorB(out) {
                    return this.m_bodyB.GetWorldPoint(this.m_localAnchorB, out);
                }
                GetReactionForce(inv_dt, out) {
                    // return inv_dt * (m_impulse.x * m_perp + (m_motorImpulse + m_impulse.z) * m_axis);
                    out.x = inv_dt * (this.m_impulse.x * this.m_perp.x + (this.m_motorImpulse + this.m_impulse.z) * this.m_axis.x);
                    out.y = inv_dt * (this.m_impulse.x * this.m_perp.y + (this.m_motorImpulse + this.m_impulse.z) * this.m_axis.y);
                    return out;
                }
                GetReactionTorque(inv_dt) {
                    return inv_dt * this.m_impulse.y;
                }
                GetLocalAnchorA() { return this.m_localAnchorA; }
                GetLocalAnchorB() { return this.m_localAnchorB; }
                GetLocalAxisA() { return this.m_localXAxisA; }
                GetReferenceAngle() { return this.m_referenceAngle; }
                GetJointTranslation() {
                    // b2Vec2 pA = m_bodyA.GetWorldPoint(m_localAnchorA);
                    const pA = this.m_bodyA.GetWorldPoint(this.m_localAnchorA, b2PrismaticJoint.GetJointTranslation_s_pA);
                    // b2Vec2 pB = m_bodyB.GetWorldPoint(m_localAnchorB);
                    const pB = this.m_bodyB.GetWorldPoint(this.m_localAnchorB, b2PrismaticJoint.GetJointTranslation_s_pB);
                    // b2Vec2 d = pB - pA;
                    const d = b2Math_js_1.b2Vec2.SubVV(pB, pA, b2PrismaticJoint.GetJointTranslation_s_d);
                    // b2Vec2 axis = m_bodyA.GetWorldVector(m_localXAxisA);
                    const axis = this.m_bodyA.GetWorldVector(this.m_localXAxisA, b2PrismaticJoint.GetJointTranslation_s_axis);
                    // float32 translation = b2Dot(d, axis);
                    const translation = b2Math_js_1.b2Vec2.DotVV(d, axis);
                    return translation;
                }
                GetJointSpeed() {
                    const bA = this.m_bodyA;
                    const bB = this.m_bodyB;
                    // b2Vec2 rA = b2Mul(bA->m_xf.q, m_localAnchorA - bA->m_sweep.localCenter);
                    b2Math_js_1.b2Vec2.SubVV(this.m_localAnchorA, bA.m_sweep.localCenter, this.m_lalcA);
                    const rA = b2Math_js_1.b2Rot.MulRV(bA.m_xf.q, this.m_lalcA, this.m_rA);
                    // b2Vec2 rB = b2Mul(bB->m_xf.q, m_localAnchorB - bB->m_sweep.localCenter);
                    b2Math_js_1.b2Vec2.SubVV(this.m_localAnchorB, bB.m_sweep.localCenter, this.m_lalcB);
                    const rB = b2Math_js_1.b2Rot.MulRV(bB.m_xf.q, this.m_lalcB, this.m_rB);
                    // b2Vec2 pA = bA->m_sweep.c + rA;
                    const pA = b2Math_js_1.b2Vec2.AddVV(bA.m_sweep.c, rA, b2Math_js_1.b2Vec2.s_t0); // pA uses s_t0
                    // b2Vec2 pB = bB->m_sweep.c + rB;
                    const pB = b2Math_js_1.b2Vec2.AddVV(bB.m_sweep.c, rB, b2Math_js_1.b2Vec2.s_t1); // pB uses s_t1
                    // b2Vec2 d = pB - pA;
                    const d = b2Math_js_1.b2Vec2.SubVV(pB, pA, b2Math_js_1.b2Vec2.s_t2); // d uses s_t2
                    // b2Vec2 axis = b2Mul(bA.m_xf.q, m_localXAxisA);
                    const axis = bA.GetWorldVector(this.m_localXAxisA, this.m_axis);
                    const vA = bA.m_linearVelocity;
                    const vB = bB.m_linearVelocity;
                    const wA = bA.m_angularVelocity;
                    const wB = bB.m_angularVelocity;
                    // float32 speed = b2Dot(d, b2Cross(wA, axis)) + b2Dot(axis, vB + b2Cross(wB, rB) - vA - b2Cross(wA, rA));
                    const speed = b2Math_js_1.b2Vec2.DotVV(d, b2Math_js_1.b2Vec2.CrossSV(wA, axis, b2Math_js_1.b2Vec2.s_t0)) +
                        b2Math_js_1.b2Vec2.DotVV(axis, b2Math_js_1.b2Vec2.SubVV(b2Math_js_1.b2Vec2.AddVCrossSV(vB, wB, rB, b2Math_js_1.b2Vec2.s_t0), b2Math_js_1.b2Vec2.AddVCrossSV(vA, wA, rA, b2Math_js_1.b2Vec2.s_t1), b2Math_js_1.b2Vec2.s_t0));
                    return speed;
                }
                IsLimitEnabled() {
                    return this.m_enableLimit;
                }
                EnableLimit(flag) {
                    if (flag !== this.m_enableLimit) {
                        this.m_bodyA.SetAwake(true);
                        this.m_bodyB.SetAwake(true);
                        this.m_enableLimit = flag;
                        this.m_impulse.z = 0;
                    }
                }
                GetLowerLimit() {
                    return this.m_lowerTranslation;
                }
                GetUpperLimit() {
                    return this.m_upperTranslation;
                }
                SetLimits(lower, upper) {
                    if (lower !== this.m_lowerTranslation || upper !== this.m_upperTranslation) {
                        this.m_bodyA.SetAwake(true);
                        this.m_bodyB.SetAwake(true);
                        this.m_lowerTranslation = lower;
                        this.m_upperTranslation = upper;
                        this.m_impulse.z = 0;
                    }
                }
                IsMotorEnabled() {
                    return this.m_enableMotor;
                }
                EnableMotor(flag) {
                    if (flag !== this.m_enableMotor) {
                        this.m_bodyA.SetAwake(true);
                        this.m_bodyB.SetAwake(true);
                        this.m_enableMotor = flag;
                    }
                }
                SetMotorSpeed(speed) {
                    if (speed !== this.m_motorSpeed) {
                        this.m_bodyA.SetAwake(true);
                        this.m_bodyB.SetAwake(true);
                        this.m_motorSpeed = speed;
                    }
                }
                GetMotorSpeed() {
                    return this.m_motorSpeed;
                }
                SetMaxMotorForce(force) {
                    if (force !== this.m_maxMotorForce) {
                        this.m_bodyA.SetAwake(true);
                        this.m_bodyB.SetAwake(true);
                        this.m_maxMotorForce = force;
                    }
                }
                GetMaxMotorForce() { return this.m_maxMotorForce; }
                GetMotorForce(inv_dt) {
                    return inv_dt * this.m_motorImpulse;
                }
                Dump(log) {
                    const indexA = this.m_bodyA.m_islandIndex;
                    const indexB = this.m_bodyB.m_islandIndex;
                    log("  const jd: b2PrismaticJointDef = new b2PrismaticJointDef();\n");
                    log("  jd.bodyA = bodies[%d];\n", indexA);
                    log("  jd.bodyB = bodies[%d];\n", indexB);
                    log("  jd.collideConnected = %s;\n", (this.m_collideConnected) ? ("true") : ("false"));
                    log("  jd.localAnchorA.Set(%.15f, %.15f);\n", this.m_localAnchorA.x, this.m_localAnchorA.y);
                    log("  jd.localAnchorB.Set(%.15f, %.15f);\n", this.m_localAnchorB.x, this.m_localAnchorB.y);
                    log("  jd.localAxisA.Set(%.15f, %.15f);\n", this.m_localXAxisA.x, this.m_localXAxisA.y);
                    log("  jd.referenceAngle = %.15f;\n", this.m_referenceAngle);
                    log("  jd.enableLimit = %s;\n", (this.m_enableLimit) ? ("true") : ("false"));
                    log("  jd.lowerTranslation = %.15f;\n", this.m_lowerTranslation);
                    log("  jd.upperTranslation = %.15f;\n", this.m_upperTranslation);
                    log("  jd.enableMotor = %s;\n", (this.m_enableMotor) ? ("true") : ("false"));
                    log("  jd.motorSpeed = %.15f;\n", this.m_motorSpeed);
                    log("  jd.maxMotorForce = %.15f;\n", this.m_maxMotorForce);
                    log("  joints[%d] = this.m_world.CreateJoint(jd);\n", this.m_index);
                }
            };
            exports_1("b2PrismaticJoint", b2PrismaticJoint);
            b2PrismaticJoint.InitVelocityConstraints_s_d = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.InitVelocityConstraints_s_P = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.SolveVelocityConstraints_s_P = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.SolveVelocityConstraints_s_f2r = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.SolveVelocityConstraints_s_f1 = new b2Math_js_1.b2Vec3();
            b2PrismaticJoint.SolveVelocityConstraints_s_df3 = new b2Math_js_1.b2Vec3();
            b2PrismaticJoint.SolveVelocityConstraints_s_df2 = new b2Math_js_1.b2Vec2();
            // A velocity based solver computes reaction forces(impulses) using the velocity constraint solver.Under this context,
            // the position solver is not there to resolve forces.It is only there to cope with integration error.
            //
            // Therefore, the pseudo impulses in the position solver do not have any physical meaning.Thus it is okay if they suck.
            //
            // We could take the active state from the velocity solver.However, the joint might push past the limit when the velocity
            // solver indicates the limit is inactive.
            b2PrismaticJoint.SolvePositionConstraints_s_d = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.SolvePositionConstraints_s_impulse = new b2Math_js_1.b2Vec3();
            b2PrismaticJoint.SolvePositionConstraints_s_impulse1 = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.SolvePositionConstraints_s_P = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.GetJointTranslation_s_pA = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.GetJointTranslation_s_pB = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.GetJointTranslation_s_d = new b2Math_js_1.b2Vec2();
            b2PrismaticJoint.GetJointTranslation_s_axis = new b2Math_js_1.b2Vec2();
        }
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYjJQcmlzbWF0aWNKb2ludC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImIyUHJpc21hdGljSm9pbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7RUFnQkU7Ozs7Ozs7Ozs7Ozs7Ozs7OztZQThCRixnRUFBZ0U7WUFDaEUsdUVBQXVFO1lBQ3ZFLG9FQUFvRTtZQUNwRSxzRUFBc0U7WUFDdEUscUVBQXFFO1lBQ3JFLGtFQUFrRTtZQUNsRSxzQkFBQSxNQUFhLG1CQUFvQixTQUFRLHVCQUFVO2dCQXFCakQ7b0JBQ0UsS0FBSyxDQUFDLHdCQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztvQkFyQnRCLGlCQUFZLEdBQVcsSUFBSSxrQkFBTSxFQUFFLENBQUM7b0JBRXBDLGlCQUFZLEdBQVcsSUFBSSxrQkFBTSxFQUFFLENBQUM7b0JBRXBDLGVBQVUsR0FBVyxJQUFJLGtCQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUUvQyxtQkFBYyxHQUFXLENBQUMsQ0FBQztvQkFFM0IsZ0JBQVcsR0FBRyxLQUFLLENBQUM7b0JBRXBCLHFCQUFnQixHQUFXLENBQUMsQ0FBQztvQkFFN0IscUJBQWdCLEdBQVcsQ0FBQyxDQUFDO29CQUU3QixnQkFBVyxHQUFHLEtBQUssQ0FBQztvQkFFcEIsa0JBQWEsR0FBVyxDQUFDLENBQUM7b0JBRTFCLGVBQVUsR0FBVyxDQUFDLENBQUM7Z0JBSTlCLENBQUM7Z0JBRU0sVUFBVSxDQUFDLEVBQVUsRUFBRSxFQUFVLEVBQUUsTUFBYyxFQUFFLElBQVk7b0JBQ3BFLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO29CQUNoQixJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztvQkFDcEQsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENB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