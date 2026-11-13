/**
 * Command-line runner: simulate without a browser and write states to disk.
 *
 *   node bacteria/build/run.js --steps 600000 --out states.json [--seed 42] [--save-every 500]
 *                              [--engine rapier|box2d] [--set rate=0.002 --set anchorLifetimeSteps=6000 ...]
 *                              [--overlap-log overlap.csv [--overlap-check]]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DEFAULT_ENGINE, createSimulation, isEngine } from "./engines.js";
import { DEFAULT_PARAMS, ENGINES, Engine, Simulation, SimulationParams } from "./model.js";
import {
  OVERLAP_CSV_HEADER, OVERLAP_TARGET_FRACTION, OVERLAP_WARMUP_STEPS, OverlapMeter, OverlapStats, overlapCsvRow,
} from "./overlap.js";

const USAGE = `Usage: node bacteria/build/run.js --steps N [options]

Options:
  --steps N         number of simulation steps to run (required)
  --out FILE        output file (default: states.json)
  --engine NAME     physics engine: ${ENGINES.join(" or ")} (default: ${DEFAULT_ENGINE})
  --seed N          random seed (default: random; printed at start)
  --save-every N    also save after every N snapshots (default: 500; 0 = only at the end)
  --set KEY=VALUE   override a simulation parameter (repeatable), e.g. --set rate=0.002
  --list-params     print all parameters with their defaults and exit
  --help            show this help

Overlap check (cell-cell penetration depth, measured at every snapshot):
  --overlap-log FILE         write one CSV row per snapshot (max/mean/p99 depth, ...)
  --overlap-warmup N         steps to let the random initial placement relax before the
                             target applies (default: ${OVERLAP_WARMUP_STEPS})
  --overlap-target F         target: max depth < F * cell width (default: ${OVERLAP_TARGET_FRACTION})
  --overlap-check            exit with status 3 if the target is missed after the warm-up

Performance:
  --timing-log FILE          write one CSV row per snapshot: step, cells, ms per step since the last snapshot

The file is rewritten in full at each save, so it is always a complete, valid JSON file.
Parameters, seed and progress are printed to stderr.`;

function fail(message: string): never {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const opts = {
    steps: NaN, out: "states.json", saveEvery: 500, engine: DEFAULT_ENGINE as Engine,
    overrides: {} as Partial<SimulationParams>,
    overlapLog: null as string | null, overlapWarmup: OVERLAP_WARMUP_STEPS, overlapTarget: OVERLAP_TARGET_FRACTION,
    overlapCheck: false, timingLog: null as string | null,
  };
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
      case "--engine": {
        const name = value();
        if (!isEngine(name)) { fail(`unknown engine "${name}" (choose ${ENGINES.join(" or ")})`); }
        opts.engine = name;
        break;
      }
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
      case "--overlap-log": opts.overlapLog = value(); break;
      case "--overlap-warmup": opts.overlapWarmup = int(value()); break;
      case "--overlap-target": {
        const raw = value();
        opts.overlapTarget = Number(raw);
        if (!(opts.overlapTarget > 0)) { fail(`--overlap-target expects a positive number, got "${raw}"`); }
        break;
      }
      case "--overlap-check": opts.overlapCheck = true; break;
      case "--timing-log": opts.timingLog = value(); break;
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
  if (opts.overlapCheck && !opts.overlapLog) { fail("--overlap-check needs --overlap-log"); }
  return opts;
}

/** Write the file piece by piece to a temp file, then rename: never leaves a half-written file. */
function save(sim: Simulation, out: string): void {
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

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const out = path.resolve(opts.out);
  let sim: Simulation;
  try {
    sim = await createSimulation(opts.engine, opts.overrides);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  console.error(`${sim.engine}, seed ${sim.params.seed}, ${opts.steps} steps, snapshot every ${sim.params.snapshotInterval} steps -> ${out}`);
  const changed = Object.entries(opts.overrides).filter(([k]) => k !== "seed");
  if (changed.length > 0) { console.error(`overrides: ${changed.map(([k, v]) => `${k}=${v}`).join(", ")}`); }

  // Overlap check
  const width = 2 * sim.params.radius;
  const targetDepth = opts.overlapTarget * width;
  const meter = new OverlapMeter();
  let overlapFd: number | null = null;
  let last: OverlapStats | null = null;
  let worst: OverlapStats | null = null; // deepest after the warm-up
  let snapshotsChecked = 0, snapshotsOverTarget = 0, meanSum = 0;
  if (opts.overlapLog) {
    overlapFd = fs.openSync(path.resolve(opts.overlapLog), "w");
    fs.writeSync(overlapFd, OVERLAP_CSV_HEADER + "\n");
    console.error(`overlap: logging to ${path.resolve(opts.overlapLog)}; target max depth < ${opts.overlapTarget} x width ` +
      `= ${targetDepth.toFixed(3)} after step ${opts.overlapWarmup}`);
  }

  // Step time (physics only: measured around sim.step(), excluding saving and the overlap check)
  let timingFd: number | null = null;
  let stepMs = 0, stepsTimed = 0;
  if (opts.timingLog) {
    timingFd = fs.openSync(path.resolve(opts.timingLog), "w");
    fs.writeSync(timingFd, "step,cells,ms_per_step\n");
  }

  let interrupted = false;
  process.on("SIGINT", () => { interrupted = true; }); // Ctrl+C: stop after the current step and save

  const start = Date.now();
  let lastReport = start;
  let savedAtSnapshot = -1;
  for (let i = 0; i < opts.steps && !interrupted; i++) {
    const t0 = performance.now();
    const snapshotTaken = sim.step();
    stepMs += performance.now() - t0;
    stepsTimed++;
    if (snapshotTaken && timingFd !== null) {
      fs.writeSync(timingFd, `${sim.stepCount},${sim.cellCount},${(stepMs / stepsTimed).toFixed(4)}\n`);
      stepMs = 0;
      stepsTimed = 0;
    }
    if (snapshotTaken && overlapFd !== null) {
      last = meter.measure(sim, sim.params.radius, targetDepth);
      fs.writeSync(overlapFd, overlapCsvRow(last, width) + "\n");
      if (sim.stepCount >= opts.overlapWarmup) {
        snapshotsChecked++;
        meanSum += last.meanDepth;
        if (last.maxDepth >= targetDepth) { snapshotsOverTarget++; }
        if (!worst || last.maxDepth > worst.maxDepth) { worst = last; }
      }
    }
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
      const overlap = last ? `, overlap max ${(last.maxDepth / width * 100).toFixed(1)}% / mean ${(last.meanDepth / width * 100).toFixed(2)}% of width` : "";
      console.error(`step ${sim.stepCount}/${opts.steps} (${(100 * sim.stepCount / opts.steps).toFixed(1)}%), ` +
        `${sim.cellCount} cells, ${sim.states.snapshotCount} snapshots, ${rate.toFixed(0)} steps/s, ETA ${formatDuration(eta)}${overlap}`);
    }
  }

  if (interrupted) { console.error(`interrupted at step ${sim.stepCount}; saving...`); }
  if (sim.states.snapshotCount !== savedAtSnapshot) { save(sim, out); }
  const seconds = (Date.now() - start) / 1000;
  console.error(`done in ${formatDuration(seconds)}, ${(sim.stepCount / seconds).toFixed(0)} steps/s average, ` +
    `${sim.cellCount} cells at the end (${sim.engine}, seed ${sim.params.seed})`);

  if (timingFd !== null) { fs.closeSync(timingFd); }
  if (overlapFd !== null) {
    fs.closeSync(overlapFd);
    const pct = (d: number) => `${(d / width * 100).toFixed(2)}% of width (${d.toFixed(4)})`;
    if (snapshotsChecked === 0) {
      console.error(`overlap: no snapshots after the warm-up (step ${opts.overlapWarmup})`);
    } else {
      const passed = snapshotsOverTarget === 0;
      console.error(`overlap after step ${opts.overlapWarmup}: ${snapshotsChecked} snapshots, worst max depth ${pct(worst!.maxDepth)} ` +
        `at step ${worst!.step}, average mean depth ${pct(meanSum / snapshotsChecked)}, ` +
        `${snapshotsOverTarget} snapshots over target -> ${passed ? "PASS" : "FAIL"}`);
      if (!passed && opts.overlapCheck) { process.exitCode = 3; }
    }
  }
}

void main();
