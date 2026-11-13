import * as testbed from "@testbed";
export declare class ParticlesSurfaceTension extends testbed.Test {
    time_step: number;
    constructor();
    Step(settings: testbed.Settings): void;
    static Create(): ParticlesSurfaceTension;
}
export declare const testIndex: number;
