import * as b2 from "@box2d";
import * as testbed from "@testbed";
/** Extra per-body state attached to each bacterium. */
interface Bacterium extends b2.Body {
    growthRate: number;
    reproductiveLength: number;
    tag?: string;
    userData?: {
        destroy?: boolean;
    };
}
export declare class WaveMachine extends testbed.Test {
    dynamicBodyCount: number;
    time_step: number;
    data: unknown[];
    bodies_params: unknown[];
    constructor();
    createJoints1(world: b2.World, body1: b2.Body, body2: b2.Body, length1: number, length2: number): void;
    createJoints2(world: b2.World, body1: b2.Body, body2: b2.Body, length1: number, length2: number): void;
    private createWeld;
    createBacteria(world: b2.World, position: b2.XY, angle: number, length: number, myColor: b2.Color, tag: string): Bacterium;
    Step(settings: testbed.Settings): void;
    GetDefaultViewZoom(): number;
    static Create(): testbed.Test;
}
export declare const testIndex: number;
export {};
