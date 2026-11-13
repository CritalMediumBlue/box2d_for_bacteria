/**
 * Create a simulation on the chosen physics engine. Each engine's code is loaded only when it is
 * used, so a Box2D run never loads Rapier's WebAssembly and vice versa.
 */

import { ENGINES, Engine, Simulation, SimulationParams } from "./model.js";

export const DEFAULT_ENGINE: Engine = "rapier";

export function isEngine(name: string): name is Engine {
  return (ENGINES as readonly string[]).includes(name);
}

export async function createSimulation(engine: Engine, overrides: Partial<SimulationParams> = {}): Promise<Simulation> {
  switch (engine) {
    case "rapier": {
      const { RapierSimulation, initRapier } = await import("./rapier-simulation.js");
      await initRapier();
      return new RapierSimulation(overrides);
    }
    case "box2d": {
      const { Box2DSimulation } = await import("./box2d-simulation.js");
      return new Box2DSimulation(overrides);
    }
  }
}
