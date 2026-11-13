/**
 * Command-line runner: simulate without a browser and write states to disk.
 *
 *   node bacteria/build/run.js --steps 600000 --out states.json [--seed 42] [--save-every 500]
 *                              [--set rate=0.002 --set anchorLifetimeSteps=6000 ...]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { BiofilmSimulation, DEFAULT_PARAMS, SimulationParams } from "./simulation.js";

const USAGE = `Usage: node bacteria/build/run.js --steps N [options]

Options:
  --steps N         number of simulation steps to run (required)
  --out FILE        output file (default: states.json)
  --seed N          random seed (default: random; printed at start)
  --save-every N    also save after every N snapshots (default: 500; 0 = only at the end)
  --set KEY=VALUE   override a simulation parameter (repeatable), e.g. --set rate=0.002
  --list-params     print all parameters with their defaults and exit
  --help            show this help

The file is rewritten in full at each save, so it is always a complete, valid JSON file.
Parameters, seed and progress are printed to stderr.`;

function fail(message: string): never {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const opts = { steps: NaN, out: "states.json", saveEvery: 500, overrides: {} as Partial<SimulationParams> };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      if (i + 1 >= argv.length) { fail(`${arg} needs a value`); }
      return argv[++i];
    };
    const int = (s: string): number => {
      const n = Number(s);
      if (!Number.isInteger(n) || n < 0) { fail(`${arg} expects a non-negative integer, got "${s}"`); }
      return n;
    };
    switch (arg) {
      case "--steps": opts.steps = int(value()); break;
      case "--out": opts.out = value(); break;
      case "--seed": opts.overrides.seed = int(value()); break;
      case "--save-every": opts.saveEvery = int(value()); break;
      case "--set": {
        const [key, raw] = value().split("=");
        if (!(key in DEFAULT_PARAMS)) { fail(`unknown parameter "${key}" (see --list-params)`); }
        const num = Number(raw);
        if (raw === undefined || raw === "" || Number.isNaN(num)) { fail(`--set ${key} needs a numeric value`); }
        (opts.overrides as Record<string, number>)[key] = num;
        break;
      }
      case "--list-params":
        for (const [k, v] of Object.entries(DEFAULT_PARAMS)) { console.log(`${k}=${v}`); }
        process.exit(0);
      case "--help": case "-h":
        console.log(USAGE);
        process.exit(0);
      default:
        fail(`unknown option "${arg}"`);
    }
  }
  if (Number.isNaN(opts.steps)) { fail("--steps is required"); }
  return opts;
}

/** Write the file piece by piece to a temp file, then rename: never leaves a half-written file. */
function save(sim: BiofilmSimulation, out: string): void {
  const tmp = `${out}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    for (const piece of sim.states.toPieces()) { fs.writeSync(fd, piece); }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, out);
  const mb = fs.statSync(out).size / 1e6;
  console.error(`  saved ${sim.states.snapshotCount} snapshots, ${sim.states.idCount} ids -> ${out} (${mb.toFixed(1)} MB)`);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : m > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const out = path.resolve(opts.out);
  let sim: BiofilmSimulation;
  try {
    sim = new BiofilmSimulation(opts.overrides);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  console.error(`seed ${sim.params.seed}, ${opts.steps} steps, snapshot every ${sim.params.snapshotInterval} steps -> ${out}`);
  const changed = Object.entries(opts.overrides).filter(([k]) => k !== "seed");
  if (changed.length > 0) { console.error(`overrides: ${changed.map(([k, v]) => `${k}=${v}`).join(", ")}`); }

  let interrupted = false;
  process.on("SIGINT", () => { interrupted = true; }); // Ctrl+C: stop after the current step and save

  const start = Date.now();
  let lastReport = start;
  let savedAtSnapshot = -1;
  for (let i = 0; i < opts.steps && !interrupted; i++) {
    const snapshotTaken = sim.step();
    if (snapshotTaken && opts.saveEvery > 0 && sim.states.snapshotCount % opts.saveEvery === 0) {
      save(sim, out);
      savedAtSnapshot = sim.states.snapshotCount;
    }
    const now = Date.now();
    if (now - lastReport >= 10000) {
      lastReport = now;
      const elapsed = (now - start) / 1000;
      const rate = sim.stepCount / elapsed;
      const eta = (opts.steps - sim.stepCount) / rate;
      console.error(`step ${sim.stepCount}/${opts.steps} (${(100 * sim.stepCount / opts.steps).toFixed(1)}%), ` +
        `${sim.cellCount} cells, ${sim.states.snapshotCount} snapshots, ${rate.toFixed(0)} steps/s, ETA ${formatDuration(eta)}`);
    }
  }

  if (interrupted) { console.error(`interrupted at step ${sim.stepCount}; saving...`); }
  if (sim.states.snapshotCount !== savedAtSnapshot) { save(sim, out); }
  console.error(`done in ${formatDuration((Date.now() - start) / 1000)} (seed ${sim.params.seed})`);
}

main();
