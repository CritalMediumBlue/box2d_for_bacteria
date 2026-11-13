/**
 * Browser viewer: runs the simulation, draws it, and saves states.
 *
 * Saving ("J" or the button): in Chrome/Edge you pick a file once; it is written immediately and
 * overwritten automatically every AUTO_SAVE_EVERY_SNAPSHOTS snapshots. Without a picked file
 * (or in browsers without the picker), auto-save downloads numbered copies instead.
 */

import * as b2 from "../../build/esm/index.js";
import { BiofilmSimulation } from "./simulation.js";

const AUTO_SAVE_EVERY_SNAPSHOTS = 500;
const STATES_FILE_NAME = "states.json";
const VIEW = { minX: -55, maxX: 55, minY: 135, maxY: 205 }; // world area to fit on screen

/** Minimal typing for the File System Access API (Chrome/Edge). */
interface WritableFileHandle {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>, close(): Promise<void> }>;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("canvas");
const ctx = canvas.getContext("2d")!;
const statusEl = $("status");
const pauseBtn = $<HTMLButtonElement>("pause");
const speedInput = $<HTMLInputElement>("speed");
const seedInput = $<HTMLInputElement>("seed");

let sim = createSimulation();
let paused = false;
let saveHandle: WritableFileHandle | null = null;
let saving = false;
let lastSaveInfo = "not saved yet";
let rateSteps = 0;
let rateTime = performance.now();
let stepsPerSecond = 0;

function createSimulation(): BiofilmSimulation {
  const seedText = seedInput.value.trim();
  const s = new BiofilmSimulation(seedText === "" ? {} : { seed: Number(seedText) });
  console.log(`Simulation started with seed ${s.params.seed}`);
  return s;
}

// ---------------------------------------------------------------- simulation loop

function advance(steps: number): void {
  for (let i = 0; i < steps; i++) {
    const snapshotTaken = sim.step();
    rateSteps++;
    if (snapshotTaken && sim.states.snapshotCount % AUTO_SAVE_EVERY_SNAPSHOTS === 0) {
      void saveStates(true);
    }
  }
}

function frame(): void {
  if (!paused) {
    const steps = Math.max(1, Math.min(100, Math.floor(Number(speedInput.value) || 1)));
    advance(steps);
  }
  const now = performance.now();
  if (now - rateTime >= 1000) {
    stepsPerSecond = (rateSteps * 1000) / (now - rateTime);
    rateSteps = 0;
    rateTime = now;
  }
  render();
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // World -> screen: fit VIEW, y pointing up
  const scale = Math.min(canvas.width / (VIEW.maxX - VIEW.minX), canvas.height / (VIEW.maxY - VIEW.minY));
  const cx = (VIEW.minX + VIEW.maxX) / 2, cy = (VIEW.minY + VIEW.maxY) / 2;
  ctx.setTransform(scale, 0, 0, -scale, canvas.width / 2 - cx * scale, canvas.height / 2 + cy * scale);
  ctx.lineWidth = 1 / scale;

  const p = new b2.Vec2();
  for (let body = sim.world.GetBodyList(); body; body = body.GetNext()) {
    const xf = body.GetTransform();
    const isCell = body.GetType() === b2.BodyType.b2_dynamicBody;
    const c = body.myCustomColor;
    ctx.fillStyle = isCell && c ? `rgb(${255 * c.r},${255 * c.g},${255 * c.b})` : "#9a9";
    ctx.strokeStyle = isCell ? "rgba(0,0,0,0.6)" : "#575";

    if (body.GetFixtureList() === null) {
      // Anchor point (static body without fixtures)
      ctx.fillStyle = "#000";
      ctx.fillRect(xf.p.x - 0.25, xf.p.y - 0.25, 0.5, 0.5);
      continue;
    }

    for (let f = body.GetFixtureList(); f; f = f.GetNext()) {
      const shape = f.GetShape();
      ctx.beginPath();
      switch (shape.GetType()) {
        case b2.ShapeType.e_polygonShape: {
          const poly = shape as b2.PolygonShape;
          for (let i = 0; i < poly.m_count; i++) {
            b2.Transform.MulXV(xf, poly.m_vertices[i], p);
            if (i === 0) { ctx.moveTo(p.x, p.y); } else { ctx.lineTo(p.x, p.y); }
          }
          ctx.closePath();
          ctx.fill();
          if (!isCell) { ctx.stroke(); }
          break;
        }
        case b2.ShapeType.e_circleShape: {
          const circle = shape as b2.CircleShape;
          b2.Transform.MulXV(xf, circle.m_p, p);
          ctx.arc(p.x, p.y, circle.m_radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case b2.ShapeType.e_edgeShape: {
          const edge = shape as b2.EdgeShape;
          b2.Transform.MulXV(xf, edge.m_vertex1, p);
          ctx.moveTo(p.x, p.y);
          b2.Transform.MulXV(xf, edge.m_vertex2, p);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 2 / scale;
          ctx.stroke();
          ctx.lineWidth = 1 / scale;
          break;
        }
      }
    }
  }

  // Anchor springs
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  const a = new b2.Vec2(), b = new b2.Vec2();
  for (let j = sim.world.GetJointList(); j; j = j.GetNext()) {
    j.GetAnchorA(a);
    j.GetAnchorB(b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  statusEl.textContent =
    `step ${sim.stepCount} · ${sim.cellCount} cells · ${sim.states.snapshotCount} snapshots · ` +
    `${stepsPerSecond.toFixed(0)} steps/s · seed ${sim.params.seed} · ${lastSaveInfo}`;
}

// ---------------------------------------------------------------- saving

function buildBlob(): Blob {
  return new Blob(sim.states.toPieces(), { type: "application/json" });
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
  if (saving) { return; } // previous save still running
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

function restart(): void {
  if (sim.states.snapshotCount > 0 && !confirm("Restart the simulation? Unsaved states will be lost.")) { return; }
  sim = createSimulation();
  saveHandle = null; // don't overwrite the previous run's file
  lastSaveInfo = "not saved yet";
}

pauseBtn.addEventListener("click", togglePause);
$("step").addEventListener("click", stepOnce);
$("save").addEventListener("click", () => void chooseFileAndSave());
$("restart").addEventListener("click", restart);
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) { return; }
  switch (e.key) {
    case " ": e.preventDefault(); togglePause(); break;
    case "n": case "N": stepOnce(); break;
    case "j": case "J": void chooseFileAndSave(); break;
  }
});
window.addEventListener("beforeunload", (e) => {
  if (sim.states.snapshotCount > 0) { e.preventDefault(); }
});

requestAnimationFrame(frame);
