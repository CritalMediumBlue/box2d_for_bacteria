/**
 * Browser viewer: runs the simulation, draws it (render.ts), measures overlaps, and saves states.
 *
 * URL parameters (all optional): engine=rapier|box2d, seed=N, style=phase|fluorescence|diagnostic,
 * speed=steps per frame, view=minX,minY,maxX,maxY (zoom into a world area, e.g. view=-50,185,-35,200 for
 * the top-left corner), and any simulation parameter by name (e.g. snapshotInterval=600).
 *
 * Saving ("J" or the button): in Chrome/Edge you pick a file once; it is written immediately and
 * overwritten automatically every AUTO_SAVE_EVERY_SNAPSHOTS snapshots. Without a picked file
 * (or in browsers without the picker), auto-save downloads numbered copies instead.
 *
 * For scripting (e.g. from a headless browser): window.biofilm exposes the simulation, the latest
 * overlap stats, timing, and download().
 */

import { DEFAULT_ENGINE, createSimulation, isEngine } from "./engines.js";
import { DEFAULT_PARAMS, Engine, Simulation, SimulationParams } from "./model.js";
import { OVERLAP_TARGET_FRACTION, OVERLAP_WARMUP_STEPS, OverlapMeter, OverlapStats } from "./overlap.js";
import { ChamberRenderer, RENDER_STYLES, RenderStyle, ViewRect } from "./render.js";

const AUTO_SAVE_EVERY_SNAPSHOTS = 500;
/** Diagnostic view: overlaps deeper than this fraction of the cell width are highlighted. */
const OVERLAP_VISIBLE_FRACTION = 0.01;
const STATES_FILE_NAME = "states.json";

/** Minimal typing for the File System Access API (Chrome/Edge). */
interface WritableFileHandle {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>, close(): Promise<void> }>;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("canvas");
const renderer = new ChamberRenderer(canvas.getContext("2d")!);
const statusEl = $("status");
const overlapEl = $("overlap");
const pauseBtn = $<HTMLButtonElement>("pause");
const speedInput = $<HTMLInputElement>("speed");
const seedInput = $<HTMLInputElement>("seed");
const engineSelect = $<HTMLSelectElement>("engine");
const styleSelect = $<HTMLSelectElement>("style");
const snapshotInput = $<HTMLInputElement>("snapshotInterval");

// ---------------------------------------------------------------- settings from the URL

const query = new URLSearchParams(location.search);
const urlOverrides: Partial<SimulationParams> = {};
for (const [key, value] of query) {
  if (key in DEFAULT_PARAMS && value !== "" && !Number.isNaN(Number(value))) {
    (urlOverrides as Record<string, number>)[key] = Number(value);
  }
}
const urlEngine = query.get("engine");
engineSelect.value = urlEngine && isEngine(urlEngine) ? urlEngine : DEFAULT_ENGINE;
const urlStyle = query.get("style") as RenderStyle | null;
styleSelect.value = urlStyle && RENDER_STYLES.includes(urlStyle) ? urlStyle : "phase";
if (query.get("seed")) { seedInput.value = query.get("seed")!; }
if (query.get("speed")) { speedInput.value = query.get("speed")!; }
snapshotInput.value = String(urlOverrides.snapshotInterval ?? DEFAULT_PARAMS.snapshotInterval);
const viewParts = (query.get("view") ?? "").split(",").map(Number);
let view: ViewRect | undefined = viewParts.length === 4 && viewParts.every(Number.isFinite) && viewParts[0] < viewParts[2] && viewParts[1] < viewParts[3]
  ? { minX: viewParts[0], minY: viewParts[1], maxX: viewParts[2], maxY: viewParts[3] } : undefined;

// ---------------------------------------------------------------- state

let sim: Simulation | null = null;
let paused = false;
let saveHandle: WritableFileHandle | null = null;
let saving = false;
let lastSaveInfo = "not saved yet";
let rateSteps = 0, rateFrames = 0, rateStepMs = 0, rateDrawMs = 0, rateTime = performance.now();
let stepsPerSecond = 0, framesPerSecond = 0, stepMsPerFrame = 0, drawMsPerFrame = 0;
const meter = new OverlapMeter();
let lastOverlap: OverlapStats | null = null;
const pairs = { i: new Int32Array(4096), j: new Int32Array(4096), depth: new Float64Array(4096), count: 0 };
let pairsStep = -1; // step the pairs were measured at (re-measured only when the simulation moved)

async function startSimulation(): Promise<void> {
  const seedText = seedInput.value.trim();
  const overrides: Partial<SimulationParams> = { ...urlOverrides, snapshotInterval: Number(snapshotInput.value) };
  if (seedText !== "") { overrides.seed = Number(seedText); }
  const engine = engineSelect.value as Engine;
  try {
    sim = await createSimulation(engine, overrides);
  } catch (e) {
    statusEl.textContent = `could not start: ${e instanceof Error ? e.message : String(e)}`;
    console.error(e);
    return;
  }
  lastOverlap = null;
  pairsStep = -1;
  console.log(`Simulation started: ${sim.engine}, seed ${sim.params.seed}`);
}

// ---------------------------------------------------------------- simulation loop

function advance(steps: number): void {
  if (!sim) { return; }
  for (let i = 0; i < steps; i++) {
    const snapshotTaken = sim.step();
    rateSteps++;
    if (snapshotTaken) {
      lastOverlap = meter.measure(sim, sim.params.radius, OVERLAP_TARGET_FRACTION * 2 * sim.params.radius);
      if (sim.states.snapshotCount % AUTO_SAVE_EVERY_SNAPSHOTS === 0) { void saveStates(true); }
    }
  }
}

function frame(): void {
  const t0 = performance.now();
  if (!paused) {
    const steps = Math.max(1, Math.min(200, Math.floor(Number(speedInput.value) || 1)));
    advance(steps);
  }
  const t1 = performance.now();
  render();
  const t2 = performance.now();
  rateStepMs += t1 - t0;
  rateDrawMs += t2 - t1;
  rateFrames++;
  if (t2 - rateTime >= 1000) { // averages over the last second
    stepsPerSecond = (rateSteps * 1000) / (t2 - rateTime);
    framesPerSecond = (rateFrames * 1000) / (t2 - rateTime);
    stepMsPerFrame = rateStepMs / rateFrames;
    drawMsPerFrame = rateDrawMs / rateFrames;
    rateSteps = rateFrames = rateStepMs = rateDrawMs = 0;
    rateTime = t2;
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- drawing

function render(): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  if (!sim) { return; }
  const style = styleSelect.value as RenderStyle;
  const radius = sim.params.radius;
  const targetDepth = OVERLAP_TARGET_FRACTION * 2 * radius;
  if (style === "diagnostic" && sim.stepCount !== pairsStep) {
    pairsStep = sim.stepCount;
    pairs.count = 0;
    const visible = OVERLAP_VISIBLE_FRACTION * 2 * radius;
    meter.measure(sim, radius, targetDepth, (i, j, depth) => {
      // Resting contacts sit ~0.1-0.5% deep (the engine's tolerance); show only deeper ones
      if (depth < visible || pairs.count === pairs.i.length) { return; }
      pairs.i[pairs.count] = i; pairs.j[pairs.count] = j; pairs.depth[pairs.count] = depth; pairs.count++;
    });
  }
  renderer.draw(sim, { style, radius, view, overlaps: style === "diagnostic" ? pairs : undefined, targetDepth });

  statusEl.textContent =
    `step ${sim.stepCount} · ${sim.cellCount} cells · ${sim.states.snapshotCount} snapshots · ` +
    `${stepsPerSecond.toFixed(0)} steps/s · ${framesPerSecond.toFixed(0)} fps ` +
    `(step ${stepMsPerFrame.toFixed(1)} ms + draw ${drawMsPerFrame.toFixed(1)} ms per frame) · ` +
    `${sim.engine} · seed ${sim.params.seed} · ${lastSaveInfo}`;
  if (lastOverlap) {
    const width = 2 * radius;
    const max = lastOverlap.maxDepth / width * 100, mean = lastOverlap.meanDepth / width * 100;
    const warmup = lastOverlap.step < OVERLAP_WARMUP_STEPS;
    overlapEl.textContent = `overlap at step ${lastOverlap.step}: max ${max.toFixed(1)}% · mean ${mean.toFixed(2)}% of cell width` +
      (warmup ? ` (warm-up: random initial placement relaxing until step ${OVERLAP_WARMUP_STEPS})` : ` (target < ${OVERLAP_TARGET_FRACTION * 100}%)`);
    overlapEl.className = warmup ? "" : max < OVERLAP_TARGET_FRACTION * 100 ? "ok" : "bad";
  } else {
    overlapEl.textContent = "overlap: measured at each snapshot";
    overlapEl.className = "";
  }
}

// ---------------------------------------------------------------- saving

function buildBlob(): Blob {
  return new Blob(sim!.states.toPieces(), { type: "application/json" });
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function saveStates(auto: boolean): Promise<void> {
  if (saving || !sim) { return; } // previous save still running
  saving = true;
  try {
    const blob = buildBlob();
    let target: string;
    if (saveHandle) {
      const writable = await saveHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      target = saveHandle.name;
    } else {
      target = auto ? `states_${sim.states.snapshotCount}.json` : STATES_FILE_NAME;
      download(blob, target);
    }
    lastSaveInfo = `saved ${sim.states.snapshotCount} snapshots to ${target} at step ${sim.stepCount}`;
    console.log(`${lastSaveInfo} (${(blob.size / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    lastSaveInfo = "save FAILED (see console)";
    console.error("Saving states failed:", e);
  } finally {
    saving = false;
  }
}

/** Pick a file to save to (where supported), then save now. */
async function chooseFileAndSave(): Promise<void> {
  const picker = (window as any).showSaveFilePicker;
  if (picker && !saveHandle) {
    try {
      saveHandle = await picker({
        suggestedName: STATES_FILE_NAME,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
    } catch {
      return; // picker cancelled
    }
  }
  await saveStates(false);
}

// ---------------------------------------------------------------- controls

function togglePause(): void {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
}

function stepOnce(): void {
  if (!paused) { togglePause(); }
  advance(1);
}

async function restart(): Promise<void> {
  if (sim && sim.states.snapshotCount > 0 && !confirm("Restart the simulation? Unsaved states will be lost.")) { return; }
  sim = null;
  await startSimulation();
  saveHandle = null; // don't overwrite the previous run's file
  lastSaveInfo = "not saved yet";
}

pauseBtn.addEventListener("click", togglePause);
$("step").addEventListener("click", stepOnce);
$("save").addEventListener("click", () => void chooseFileAndSave());
$("restart").addEventListener("click", () => void restart());
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) { return; }
  switch (e.key) {
    case " ": e.preventDefault(); togglePause(); break;
    case "n": case "N": stepOnce(); break;
    case "j": case "J": void chooseFileAndSave(); break;
  }
});
window.addEventListener("beforeunload", (e) => {
  if (sim && sim.states.snapshotCount > 0) { e.preventDefault(); }
});

// For scripted use (headless browser, console)
(window as any).biofilm = {
  get sim() { return sim; },
  get overlap() { return lastOverlap; },
  get timing() { return { stepsPerSecond, framesPerSecond, stepMsPerFrame, drawMsPerFrame }; },
  /** Download all snapshots as one JSON file (same as "Save states…" without the file picker). */
  download: (fileName: string = STATES_FILE_NAME) => { if (sim) { download(buildBlob(), fileName); } },
  pause: () => { if (!paused) { togglePause(); } },
  resume: () => { if (paused) { togglePause(); } },
  advance,
  /** Zoom into a world area ({minX, minY, maxX, maxY}), or the whole chamber with no argument. */
  setView: (rect?: ViewRect) => { view = rect; },
};

void startSimulation().then(() => requestAnimationFrame(frame));
