import * as b2 from "@box2d";
import * as testbed from "@testbed";
/** Extra per-body state attached to each bacterium. */
interface Bacterium extends b2.Body {
    growthRate: number;
    reproductiveLength: number;
    id: number;
    userData?: {
        destroy?: boolean;
    };
}
interface BodyParams {
    x: number;
    y: number;
    angle: number;
    length: number;
    id: number;
    time: number;
}
export declare class MicrofluidicBiofilm extends testbed.Test {
    dynamicBodyCount: number;
    time_step: number;
    data: unknown[];
    bodies_params: BodyParams[];
    private nextId;
    private lineage;
    private snapshotParts;
    private saveHandle;
    private saving;
    constructor();
    Step(settings: testbed.Settings): void;
    /** Record x, y, id, an, le (2 decimals) for every bacterium currently alive. */
    private takeSnapshot;
    /** Assemble the LowRes-format file from the stored pieces (no single giant string). */
    private buildStatesBlob;
    private downloadBlob;
    /**
     * Save all snapshots so far. With a file chosen via "j" (Chrome/Edge), that file is
     * overwritten; otherwise a copy is downloaded (numbered when auto-saving).
     */
    private saveStates;
    /** "j": choose a file to save to (where supported), then save now. */
    private chooseFileAndSave;
    download_data(): void;
    Keyboard(key: string): void;
    static Create(): testbed.Test;
    calculateFactor(proportion: number, length: number, a: number): number;
    calculateFactor2(length: number, a: number, proportion: number): number;
    calculateOffset(factor: number, originalAngle: number): b2.Vec2;
    calculateNewPosition(originalPosition: b2.Vec2, offset: b2.Vec2): b2.Vec2;
    createBody(vec1: b2.Vec2, vec2: b2.Vec2): void;
    createTriangleBody(x: number, y: number, vertices: b2.Vec2[]): void;
    createTrianglesx(count: number, ...vecs: b2.Vec2[][]): void;
    createTrianglesy(count: number, ...vecs: b2.Vec2[][]): void;
    createContainer(...vecs: b2.Vec2[][]): void;
    createBacteria(world: b2.World, position: b2.XY, angle: number, length: number, myColor: b2.Color, parentId: number): Bacterium;
    createJointsToNearbyBodies(world: b2.World, body: b2.Body, maxDistance: number): void;
    createStaticJoints(world: b2.World, body: b2.Body): void;
}
export declare const testIndex: number;
export {};
