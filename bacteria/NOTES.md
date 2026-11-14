# Rapier port: notes

Overnight work log for porting the microfluidic biofilm simulation from the Box2D port to
[Rapier](https://rapier.rs) (`@dimforge/rapier2d-compat` 0.21.0, 2D, WebAssembly).

## Status (14 November, afternoon)

- **Done:** Rapier is the default engine, with the full model, in the browser and on the command
  line; Box2D is still selectable for comparison. Rendering (phase contrast, fluorescence,
  diagnostic) is separate from the physics. Snapshots and the download use the unchanged
  `LowRes.json` schema.
- **Model changes decided today** (all apply to both engines; see "Changes to the model"):
  - Anchors let go once the colony has dragged their cell more than 2 units from the anchor point
    (`anchorMaxStretch=2`), like extracellular matrix yielding. This removed the deep overlap
    excursions caused by stretched anchor springs.
  - Drag is continuous body damping (`continuousDrag=1`) instead of a kick every 25 steps, and
    cells grow in 5 groups spread over the 25-step cycle (`growthGroups=5`). This removed the
    periodic stop-and-go and back-and-forth motion you noticed: single-cell wobble went from
    0.094 to 0.026 units.
  - 8 solver iterations instead of 12, with the overlap target relaxed from 5% to 8% of the cell
    width, as you asked.
- **Overlap (max < 8% of the cell width):** met at every snapshot of the 3-seed × 120 000-step
  validation (worst 7.3%; 2 of 1173 snapshots above 5%). Typical snapshot: deepest pair ~0.9% of
  the width, mean 0.07%. <!-- STATUS-LONGRUN -->
- **Performance:** 8.7 ms per step with a full chamber, 19% faster than the overnight version
  (10.7 ms), and Rapier is 6–7× faster than Box2D. The slowest steps went from 17 to 11 ms, so the
  browser runs more evenly.
- **Rapier 0.21 problems worked around:** stale contacts when a collider grows, and a memory
  leak in that workaround (see "Rapier contact bug"); also a fixed cost on every step in which
  colliders change (see "Performance").
- **Deliverables:**
  - long-run state file `bacteria/output/states-rapier-600k-seed7.json` (gitignored):
    <!-- STATE-FILE -->
    Earlier long runs are kept for comparison:
    `bacteria/output/states-rapier-600k-seed7-anchorhold.json` (overnight; anchors never let go;
    187 MB, 2000 snapshots) and `…-kickdrag-partial.json` (anchors let go, drag kick; stopped at
    ~238 000 steps when the drag changed; holds the first 500 snapshots, to step 150 000);
  - `reports/overlap-report.md`, with the CSV logs in `reports/data/` and charts;
  - this file.

## How to run

```sh
npm install
npm run build-bacteria                      # library (ES modules) + bacteria/

# Browser: serves the repo and opens bacteria/index.html
npm run start-bacteria
#   URL options: ?engine=rapier|box2d&seed=7&style=phase|fluorescence|diagnostic&speed=20
#   and any parameter by name, e.g. &snapshotInterval=600&rapierContactFrequency=120

# Command line (Rapier by default)
node bacteria/build/run.js --steps 600000 --seed 7 --out bacteria/output/states.json \
     --overlap-log bacteria/output/overlap.csv --overlap-check
node bacteria/build/run.js --list-params    # every parameter and its default
node bacteria/build/run.js --engine box2d --steps 30000 ...   # the original engine, for comparison
```

`--overlap-check` makes the run exit with status 3 if the overlap target is missed after the
warm-up. `python3 bacteria/tools/overlap_report.py overlap.csv` summarises an overlap log.

## What was implemented

- **Rapier engine** (`src/rapier-simulation.ts`): the full model (growth, division, random death,
  cells leaving through the open bottom and the sides, wall-zone growth rate and colour, surface
  anchors that expire, snapshots, lineage) on Rapier, with capsule colliders.
- **Engine-independent core** (`src/model.ts`): all parameters, chamber geometry, cell mass, and the
  `Simulation` interface that the runner, viewer, renderer and overlap check use. Box2D stays
  available (`--engine box2d`, or the Engine menu) as the reference; Rapier is the default.
- **Rendering separate from physics** (`src/render.ts`): reads cells only through `Simulation`.
  Three views: phase contrast (default: dark cells with bright halos on grey, PDMS walls with
  halos, camera grain and uneven illumination), fluorescence (wall-zone cells green, centre cells
  magenta, on black), diagnostic (flat colours, anchors and springs, overlapping cells
  highlighted). Each cell is one stroked segment with round caps; cells are batched into a few
  paths per frame.
- **State recording/export**: unchanged `LowRes.json` schema (both engines produce the same format).
  Snapshot interval configurable (`snapshotInterval`, `--set`, the viewer's "Snapshot every" field
  or `?snapshotInterval=`). Download: "Save states…" / J, or `window.biofilm.download()`.
- **Overlap check** (`src/overlap.ts`, `run.js --overlap-log/--overlap-check`,
  `tools/overlap_report.py`, live readout and diagnostic view in the browser): penetration depth of
  every touching pair of cells (capsule–capsule: 2·radius − distance between the axes) and of cells
  into the walls and wall triangles, at every snapshot, at full precision.
- **Performance logging**: `run.js --timing-log` (ms per step vs. cell count); the viewer shows
  steps/s, fps and step/draw time per frame.

## Design decisions

**Match Box2D first.** The goal was parity, so the Rapier version reproduces the Box2D model step
for step, including its quirks, and differences are limited to the contact physics and the fixes
below. Each fix is a parameter whose `0` value restores the original behaviour, and the fixes
apply to both engines (Box2D with `centredDivision=0 dragClamp=0 anchorMaxStretch=0
continuousDrag=0 growthGroups=1` and the old drag values gives output byte-identical to before
the port; checked for seed 7, 3000 steps). `continuousDrag=0 growthGroups=1` also reproduces the
code from before those two changes exactly, in both engines (checked: Rapier 9000 steps, Box2D
3000 steps).

| Aspect | Box2D | Rapier | Notes |
|---|---|---|---|
| Cell shape | box + 2 circles | `capsule(length/2, radius)` | same outline, long axis = local y in both |
| Growth | vertices scaled in place | collider replaced with a longer one | see "Rapier contact bug" below; both engines grow cells in `growthGroups` groups spread over the cycle |
| Mass / inertia | computed at birth, never updated | same values (`cellMassProperties`), set on the body; collider density 0 | Box2D counts the end caps' overlap with the box twice; kept |
| Drag | body damping (`SetLinearDamping`/`SetAngularDamping`), set at birth; with `continuousDrag=0` the testbed's force −k·v once per fixture (3×) on growth steps | body damping (`setLinearDamping`/`setAngularDamping`), set at birth; with `continuousDrag=0` the same kick as an impulse | see `continuousDrag` below |
| Friction | U(0,1) per cell, walls 0.2, mixed as √(f₁f₂) | collider friction √f with the Multiply rule → exactly √(f₁f₂) | Rapier has no geometric-mean rule |
| Restitution | 0, mixed by max | 0, Max rule | |
| Anchors | zero-length distance joint to a new static body, stiffness from 0.8 Hz / ζ 0.3 | `JointData.spring(0, m·ω², 2·m·ζ·ω)` to a new fixed body | verified: Rapier's spring is force-based (measured period 1.2500 s vs 1.25 s) |
| Walls | zero-thickness edges | 2-unit-thick boxes whose inner faces lie on the edges | thick walls can't be tunnelled through under pressure |
| Wall triangles | as listed | reordered counter-clockwise | Rapier lets cells pass through clockwise triangles |
| Division | parent destroyed, 2 new bodies | parent's body reused for daughter 1 (new id, zero velocity, new mass), 1 new body | fewer bodies created; same result |
| Random numbers | per cell: division share, death, anchor; per new cell: friction, division length | same order | same seed → same run within an engine (not across engines) |
| Removed cells | `DestroyBody` | `removeRigidBody` (also removes its springs) | |

**Rapier contact bug (important).** In Rapier 0.21, a contact between two colliders that barely
move relative to each other keeps its old contact points, and resizing a collider
(`setHalfHeight`/`setShape`) does not refresh them. A cell at rest — most cells once the chamber is
full — then grows straight into its neighbours and the walls while the contact reports zero depth.
Overlap rose steadily once the chamber filled (mean penetration 0.2% → 6% of the width over
25 000 steps). `tools/rapier-stale-contacts.mjs` is a minimal reproduction.

- Fix (`rapierRefreshContacts=1`, default): replace the cell's collider on every growth step, which
  gives it fresh contacts. **Rapier 0.21 leaks WebAssembly memory** doing this when the collider
  touches others (~13 MB per 1000 steps with ~1700 cells; colliders that touch nothing don't leak):
  the first 600 000-step run aborted at step ~231 500 with a WebAssembly "unreachable" trap when
  the 4 GB heap ran out. Freeing a world gives the memory back, so every
  `rapierRebuildInterval` (10 000) steps the simulation moves all cells, anchors and walls into a
  fresh Rapier world with identical state (positions, angles, velocities, masses, colliders,
  springs) and frees the old one. A probe that replaces 1700 touching colliders every 25 steps
  plateaus at ~430 MB this way.
- Tried and kept as an option (`rapierRefreshContacts=2`): resize in place and turn the collider by
  π on its body (same capsule in the world, no allocation). Most contacts are recomputed, but some
  between two cells that both turned are not; validation (3 seeds × 120 000 steps): 2 / 2 / 8 of
  391 snapshots over the overlap target (worst 11%) instead of 0 / 0 / 0.
- The runner saves the snapshots recorded so far (and exits with status 4) if the engine throws;
  the viewer pauses with a message.

**Changes to the model, with reasons** (all apply to both engines; `0` restores the original):

- `centredDivision=1`: the testbed placed the two daughters shifted along the axis by
  radius·(proportion − ½), so one daughter's tip poked up to 0.2·radius (10% of the cell width)
  past the parent's end, into whichever neighbour touched it there. Now the daughters exactly fill
  the parent's outline.
- `dragClamp=1`: drag is one explicit kick every growth step. For cells shorter than ~1.4 (common
  small daughters) the kick removed more than all of the spin, reversing it and multiplying it by
  up to ~1.4 each time; cells without neighbours (e.g. near the exit) spun up until the engine's
  speed limit (15π rad/s in Rapier) and hit their neighbours like propellers. Traced as the cause
  of isolated deep-overlap spikes. Now a kick removes at most all of a cell's velocity/spin; cells
  whose kick removed less than that behave exactly as before.
- `anchorMaxStretch=2` (decided 14 November): an anchor lets go of its cell once the cell's
  centre is more than 2 units from the anchor point (checked every growth step), as
  extracellular matrix would yield. The testbed's anchors never let go. Their 0.8 Hz springs are
  too soft to hold a cell, so the colony dragged anchored cells 3–8 units away, and the
  stretched springs then pulled them back hard enough to push them into their neighbours. That
  caused all the remaining overlap excursions (see "Overlap results"). Effect on organisation
  (seeds 7 / 11 / 23, steps 15 000–120 000): centre ⟨cos 2θ⟩ +0.30 / +0.29 / +0.30 →
  +0.52 / +0.49 / +0.47; wall zones −0.19 / −0.18 / −0.23 → −0.13 / −0.19 / −0.19 (unchanged within
  seed-to-seed variation). A 1-unit limit was also tested: it removes the excursions too but
  changes the wall zones (⟨cos 2θ⟩ ≈ 0 to +0.15).
- Cell size 0.8× (your request): radius 0.4, initial length 2.4–4.8, division at 4.8 ± 1.0. Drag
  coefficients scaled by 0.8² (linear) and 0.8⁴ (angular) so each kick changes a cell's velocity
  by the same fraction as at the old size (mass ∝ area, inertia ∝ mass·length²).
- `continuousDrag=1` and `growthGroups=5` (decided 14 November, after you noticed the colony
  moving back and forth periodically). The testbed applied drag as one kick every 25 steps, on the
  same step on which every cell grew. Measured on a full chamber (seed 7, 3000 steps recorded every
  step), each kick removed 50–100% of a cell's velocity at once (centre cells: 0.19 → 0.02
  units/s), nothing slowed cells in between, and the synchronous growth pushed everything again on
  the same step. The result was a stop-and-go rhythm every 25 steps, plus a left–right sway with a
  50-step period in the centre (0.06 units/s; 0.17 with the drag before the overnight fixes).
  - Drag is needed: without any, cells keep their momentum and the colony streams out (1753 →
    1521 cells in 3000 steps and falling; the centre flows to the exit twice as fast). Bacteria
    live where viscosity dominates and stop when nothing pushes them.
  - `continuousDrag=1`: drag is each body's own linear and angular damping, which the engine
    applies every step (v ← v / (1 + dt·rate)). It has the same time-averaged strength as the kick:
    rate = 3·k / (growthInterval · mass), and the inertia for the angular part
    (`continuousDampingRate` in model.ts). It is set once at birth (mass is fixed then), so it
    costs nothing per step. Alone, it keeps the cell count and the flow to the exit (6.1 units per
    3000 steps either way) and almost removes the sway, but a pulse every 25 steps remains from
    synchronous growth.
  - `growthGroups=5`: cells grow (and divide, and are checked for leaving, death and anchoring) in
    5 groups spread over the 25-step cycle, each cell in its mother's group. Each cell still grows
    once every 25 steps. 25 groups (one per step) is equally smooth to the eye but slower; see
    "Performance".
  - Result (full chamber, seed 7): single-cell wobble around the steady flow (peak to peak,
    median / 99th percentile) 0.094 / 0.205 units → 0.026 / 0.139. The centre's collective
    back-and-forth: 0.044 → 0.014 units. The stop-and-go is gone (centre speed 0.146–0.153 units/s
    across the cycle). What remains of the groups is a 5-step ripple near the walls of ~0.0004
    units. Overlap also dropped (see "Overlap results").

## Rapier solver settings

Rapier's defaults (4 solver iterations, contact natural frequency 30 Hz) are made for games; here
they let the packed colony compress well past the overlap target once the chamber is full. Each
fix above was found by measuring overlaps, then the solver was tuned by sweeps (seed 7, overlap
measured every snapshot; statistics from step 9000, when the chamber is nearly full, to 45 000):

| Setting | Snapshots over target | Worst max | Worst p99 | Pairs over target / snapshot | Worst wall |
|---|---|---|---|---|---|
| 4 iterations, 30 Hz, **before** the contact fix (to step 21 900) | 30 / 44 | 63% | 23% | 263 | 50% |
| 4 iterations, 30 Hz, contact fix only (to step 30 000) | 57 / 71 | 100% | 28% | 443 | 50% |
| 8 iterations, 120 Hz | 86 / 121 | 94% | 5.2% | 8.7 | 50% |
| 4 iterations, 240 Hz | 44 / 121 | 31% | 2.7% | 0.9 | 50% |
| 8 iterations, 240 Hz | 1 / 121 | 20% | 1.3% | 0.0 | 50% |
| 16 iterations, 240 Hz | 17 / 121 | 13% | 2.6% | 0.2 | 50% |
| 2 substeps × 8 iterations, 240 Hz | 18 / 121 | 52% | 2.0% | 0.2 | 45% |
| 8 iterations, 480 Hz | 0 / 121 | 4.0% | 0.8% | 0.0 | 27% |

(The last six rows have all fixes, including `dragClamp` and `centredDivision`. Percentages are of
the cell width; "wall" is the deepest penetration into a wall or wall triangle.)

The failures in the softer settings are rare, local events, mostly in the dead-end top corners
after ~27 000 steps: one pair (or one cell against the wall) pressed deeper over many steps while
the cells around it are packed and held by anchors. More iterations or substeps did not prevent
them; stiffer contacts did.

Then three seeds (7, 11, 23) × 120 000 steps, statistics from step 3000:

| Setting | Snapshots over target (per seed) | Worst max | Median max | Relative step time |
|---|---|---|---|---|
| 8 iterations, 480 Hz | 6 / 3 / 9 of 391 | 13.6% | 1.3–1.5% | 1 |
| 12 iterations, 480 Hz | 2 / 0 / 1 of 391 | 8.7% (and one 100%¹) | 1.0% | ~1.2 |
| 16 iterations, 480 Hz (to ~84 000 steps) | 20 / 2 / 7 of ~250 | 32% | — | ~1.4 |
| **12 iterations, 720 Hz (default)** | **0 / 0 / 0 of 391** | **4.9%** | **1.0%** | ~1.2 |

¹ a pair crossed at the random start that separated only after the warm-up.

(These runs replaced colliders without world rebuilds, which leaks memory, and anchors never let
go. With a rebuild every 10 000 steps they had 2 / 2 / 2 of 391 over the target, all caused by
stretched anchor springs; with anchors letting go at 2 units, 0 / 0 / 0.)

So the overnight default was 12 iterations with 720 Hz contacts. Contact stiffness costs no step
time; more iterations do, and beyond 12 they made things worse at 480 Hz (as 16 did at 240 Hz
above).

**14 November: 8 iterations.** Continuous drag and spread growth roughly halved the typical
overlap, and you accepted a maximum of about 8% (instead of 5%) for speed. Validation with the
new model (3 seeds × 120 000 steps, 720 Hz; details in the overlap report):

| Iterations | Snapshots over 8% / over 5% (of 1173) | Worst max | Step time at a full chamber |
|---|---|---|---|
| 12 | 0 / 0 | 4.9% | ~1.5× that of 8 iterations |
| **8 (default)** | **0** / 2 | 7.3% | 8.7 ms |
| 6 | 4 / 17 | 20.6% | ~0.85× |
| 5 | 8 / 34 | 18.6% | — |
| 4 | 10 / 26 (to ~57 000 steps) | 25.7% | ~0.6× |
| 3, 2 (seed 7 only) | 20 / 58, 130 / 142 of 191 | 16.8%, 56.9% | — |

At 4 iterations a stiffer contact (1440 Hz) was worse than 720 Hz (worst 10.4% vs 4.9% on seed 7),
and at 6 iterations it made no difference.

Contact stiffness can be changed per run (`--set rapierContactFrequency=…`,
`rapierSolverIterations`, `rapierSubsteps`, `rapierPgsIterations`).

## Rendering

`render.ts` draws from the `Simulation` interface only (cell centre, angle, length, id, colour;
anchors), so physics and drawing can change independently. Each cell is one segment stroked with
round caps (a capsule), batched into a few paths per frame; the per-frame cell buffer is reused.

- **Phase contrast** (default): grey medium, cells dark (four shades, by id) with a bright halo and
  a slightly lighter core, PDMS walls lighter with bright/dark edge halos, the open channel below
  the chamber, fixed camera grain and uneven illumination.
- **Fluorescence**: cells glow in the region colours (wall zone green, centre magenta) on black.
- **Diagnostic**: flat colours with true capsule outlines on top, anchors (black squares) and their
  springs, and overlapping pairs highlighted: orange above 1% of the cell width, red above the
  target (8%; 5% until 14 November). Use it with `view=minX,minY,maxX,maxY` (or `biofilm.setView(...)`) to zoom in.

Remaining per-frame allocations are the position objects Rapier's JS API returns for each cell
(`body.translation()`; there is no bulk getter) and a few closures.

## Determinism

Same seed, same engine, same machine → identical output (checked: two Rapier runs, seed 7, first
45 000 steps byte-identical overlap logs). Box2D and Rapier runs with the same seed start from the
same initial cells but diverge after the first contacts. Cross-machine determinism of the
WebAssembly build was not tested (`@dimforge/rapier2d-deterministic-compat` exists if needed).

## Performance

Intel Xeon E-2246G (3.6 GHz), Node 22, one process; median time per simulation step by number of
cells (seed 7; `--timing-log`, physics only). The chamber holds ~1700–1800 cells once full; the
largest count seen in a run was ~1820.

Overnight measurements (testbed drag kick and synchronous growth, 12 iterations):

| Cells | Rapier (12 it., 720 Hz) | Rapier, without the contact fix | Box2D |
|---|---|---|---|
| 750–1000 | 3.1 ms (323 steps/s) | 2.9 ms | 24.5 ms (41 steps/s) |
| 1000–1250 | 5.0 ms (202 steps/s) | 4.3 ms | 32.2 ms (31 steps/s) |
| 1250–1500 | 6.6 ms (151 steps/s) | 6.2 ms | 42.5 ms (24 steps/s) |
| 1500–1750 | 12.4 ms (81 steps/s) | 12.6 ms | 54.8 ms (18 steps/s) |
| 1750–2000 | 11.0 ms (91 steps/s) | 11.0 ms | 74.4 ms (13 steps/s) |

Rapier is **6–7× faster** than Box2D at the same cell count, with ~3× the solver work Rapier
needs by default (12 instead of 4 iterations; with 4 iterations and 30 Hz it ran ~600 steps/s at
1000 cells but failed the overlap target). A 600 000-step run takes ~2 h instead of ~13 h. The
contact fix (replacing colliders) costs up to ~12% while the colony grows and ~0–5% once the
chamber is full. Step time grows faster than linearly near a full chamber (more contacts
per cell). Overlap measurement: ~5 ms per snapshot at 1770 cells (every 300 steps: <0.2%).

**Final defaults (14 November).** The same colony state (seed 7 at step 12 000, ~1650 cells) was
continued in each configuration for 4000 steps on an otherwise idle machine, with each run
measured twice:

| Configuration | Mean step | Steps with growth | Other steps |
|---|---|---|---|
| Overnight: drag kick, all cells grow on one step, 12 iterations | 10.7 ms | 17.1 ms (1 in 25) | 10.2 ms |
| **Final: continuous drag, 5 growth groups, 8 iterations** | **8.7 ms (−19%)** | 10.9 ms (1 in 5) | 7.9 ms |

Measured under load (relative only): 25 groups instead of 5 cost ~5% more. Continuous drag alone
costs nothing.

Why the groups matter: Rapier spends ~2.4 ms extra (at ~1650 cells) on any step in which any
collider changes, plus ~3 µs per changed collider. Growth changes colliders (replacing them, or
resizing them in place: both cost the same). One group per step therefore pays the fixed cost on
every step (+14% at 12 iterations). With 5 groups it is paid on 5 steps of 25 (+9%), and the
largest single step stays well below the old spike every 25 steps (17 ms). Our own model code
takes 0.2–0.3 ms per step.
<!-- PERF-LONGRUN -->
**Overnight 600 000-step run** (seed 7, anchors never letting go, overlap measured every snapshot): 2 h 32 min,
66 steps/s overall. Physics median 14.2 ms/step at ~1740 cells over steps 30 000–600 000 (19 ms
during steps 240 000–360 000, while validation runs shared the CPU).

**Memory** (resident size of the Node process in the overnight run): 423 MB at step 31 000, 462 MB at
112 000, 625 MB at 197 000, 765 MB at 326 000, then 996 MB from ~465 000 to the end. It grows in
steps because the WebAssembly heap never shrinks. Without world rebuilds it hit the 4 GB limit at
step ~231 500. Growth is now much slower but not zero (see "Worth reviewing", item 8).

**Browser** (headless Chrome 156 on the same machine, 1400×900 canvas): physics runs at the same
speed as in Node (12.5 ms/step at 1684 cells, measured in the page). Drawing takes ~1 ms of
script time per frame in the phase-contrast and fluorescence views (1700 cells) and ~28 ms in
the diagnostic view (capsule outlines plus the overlap measurement). The headless browser renders
on the CPU and showed only 16–22 fps even when paused, so its frame rates are not representative;
in a desktop browser with GPU canvas, 1 step per frame (12.5 + 1 ms) fits a 60 Hz frame, and
"Steps/frame" trades smoothness for speed (each extra step adds ~12 ms per frame at a full
chamber). Running the physics in a Web Worker would decouple the two (not done).

## Overlap results

Full details, method and charts: `reports/overlap-report.md`. Percentages are of the cell width
(0.8); statistics are taken after the 3000-step warm-up. The random start overlaps heavily, and
Rapier separates it within ~1500–3000 steps.

Target: max < 8% of the width since 14 November (5% before; both counts are given).

| Run | Snapshots over 8% / over 5% | Worst max | Median max | Mean (overlapping pairs) |
|---|---|---|---|---|
<!-- OVERLAP-LONGRUN -->| **120 000 steps, seeds 7 / 11 / 23, final defaults** | **0 / 0 / 0** / 0 / 0 / 2 of 391 | 3.6% / 3.9% / 7.3% | 0.9% | 0.07% |
| same, 12 iterations | 0 / 0 of 1173 | 4.9% | 0.85% | 0.06% |
| drag kick and synchronous growth, 12 it., anchors let go at 2 units | 0 / 0 of 1173 | 3.4% | 1.0% | 0.17% |
| same, anchors never let go (`anchorMaxStretch=0`) | 4 / 6 of 1173 | 20.8% | 1.0% | 0.19% |
| 600 000 steps, seed 7, anchors never let go | 10 / 20 of 1991 | 20.8% | 1.0% | 0.19% |
| Box2D, anchors never let go, seed 7, 30 000 steps | most / 86 of 91 | 100% | 38.8% | 6.8% |

With anchors that never let go, every exception was one pair (two pairs in a few snapshots) in a
single snapshot, in the upper part of the chamber, mostly near the side walls, where anchored
cells are dragged by the colony. The overnight long run's first 120 000 steps reproduce the
seed-7 validation run byte for byte, which confirms determinism across world rebuilds.

## Colony organisation

**Final defaults vs before** (Rapier, averages over steps 15 000–120 000, seeds 7 / 11 / 23;
`tools/organization.py`):

| | cells | ⟨cos 2θ⟩ centre | ⟨cos 2θ⟩ wall zones | S centre |
|---|---|---|---|---|
| drag kick, synchronous growth, 12 it. (anchors let go at 2) | 1735–1746 | +0.52 / +0.49 / +0.47 | −0.13 / −0.19 / −0.19 | 0.47–0.53 |
| **final defaults** | 1731–1750 | +0.49 / +0.50 / +0.48 | −0.14 / −0.07 / −0.09 | 0.49–0.50 |

The centre is aligned towards the exit as before. The wall-zone cells still lie across the chamber,
slightly less so than before. Cell count and length (2.90–2.92) are unchanged.

### Rapier vs Box2D

With anchors letting go at 2 units (before continuous drag and spread growth), same seed and
window:

| | cells | mean length `le` | ⟨cos 2θ⟩ centre | ⟨cos 2θ⟩ wall zones | S centre | S wall zones |
|---|---|---|---|---|---|---|
| Box2D | 1846 | 2.93 | +0.21 | +0.15 | 0.21 | 0.15 |
| Rapier | 1702 | 2.93 | +0.37 | −0.11 | 0.38 | 0.15 |

Box2D's centre aligns less, and its wall-zone cells point along the chamber more than Rapier's.
The engines differ more here than with anchors that never let go (below). Box2D still overlaps
heavily: 87 of 91 snapshots over the target, median max 31% of the width. Its packing is
therefore not comparable cell for cell, and Box2D is no longer a reliable reference for the
organisation.

Same seed (7), anchors never letting go (the comparison was made before `anchorMaxStretch=2`
became the default), averages over steps 15 000–30 000 (chamber full), from the
exported states (`tools/organization.py`; ⟨cos 2θ⟩ = +1 for cells along the chamber's long axis
towards the exit, −1 across it; S = nematic order):

| | cells | mean length `le` | ⟨cos 2θ⟩ centre | ⟨cos 2θ⟩ wall zones | S centre | S wall zones |
|---|---|---|---|---|---|---|
| Box2D | 1856 | 2.92 | +0.23 | +0.05 | 0.23 | 0.12 |
| Rapier | 1695 | 2.95 | +0.32 | −0.01 | 0.34 | 0.06 |

Both engines produce the same organisation: cells in the centre align towards the exit as the
chamber fills (both reach ⟨cos 2θ⟩ ≈ +0.37–0.39 by step 30 000; Rapier gets there sooner), the
wall zones stay disordered, and the length distribution matches. Box2D holds ~9% more cells in
the full chamber because it lets them overlap more (see the overlap report). Over longer runs
the centre stays aligned and the wall-zone cells tend to lie across the chamber. In the
overnight 600 000-step Rapier run (anchors never letting go) the organisation is steady: averages per 120 000-step window
(the first starting at 15 000) are 1725–1749 cells, `le` 2.90–2.92, centre ⟨cos 2θ⟩ +0.295 to
+0.308, wall zones −0.19 to −0.14, S centre 0.30–0.31. Box2D was only run to 30 000 steps (it is
slow), so longer-term organisation was not compared.

## Worth reviewing / not done

1. **Wall penetration under sustained pressure.** Not part of the stated target (pairwise), but
   measured: the deepest cell–wall contact per snapshot is typically 4–5% of the cell width with
   the final defaults (12–15% when anchors never let go). The deepest contacts are cells pressed
   into the walls and between the small wall triangles, mostly in the dead-end top corners.
   Occasionally a cell's axis still reaches the wall line (50%). Contacts there carry the colony's
   accumulated pressure. Isolated tests show the contacts themselves work; it is the solver's
   limit under that load. Options: more iterations, or a small contact skin on the walls
   (`ColliderDesc.setContactSkin`; untested).
2. **Anchor model.** Anchors are still the testbed's soft 0.8 Hz springs (stiffness from the
   cell's mass), now releasing at 2 units of stretch. Before release, the colony drags anchored
   cells up to that far. Spring stretch with anchors that never let go, at step 24 000 (seed 7),
   median / 90th percentile / max: Box2D 2.1 / 6.3 / 11.6 units, Rapier 1.4 / 3.8 / 8.3. If
   anchors are meant to pin cells firmly until they yield, a stiffer spring with the same release
   distance would match that better. The release distance (2 units) is a model parameter; 1 unit
   was also tested (see "Changes to the model").
3. **Rapier contact bug** (`tools/rapier-stale-contacts.mjs`, a minimal reproduction; not reported
   upstream, by decision). If a later Rapier version fixes it, `rapierRefreshContacts=0` saves
   5–12% of the step time and makes world rebuilds unnecessary; the reproduction script shows
   whether a version is fixed.
4. **Drag strength.** Drag is now continuous, with the testbed's time-averaged strength. It is
   the testbed's form: the same drag coefficient for every cell, whatever its length (fluid drag
   on a rod grows with its length). Its strength sets how fast cells settle (velocity decay time
   ~0.5 s for a 3-unit cell, shorter for small cells) and was not recalibrated.
5. **No random motion.** Cells feel no random forces or impulses (no Brownian or thermal noise,
   and daughters keep the parent's exact angle). All randomness is in the initial cells, division
   (split proportion, division length), friction, death and anchoring. Motion comes only from
   growth pressure, contacts, anchors and drag.
6. **Kept testbed quirks**: mass fixed at birth (counts the end caps twice); anchors created for a
   cell that divides in the same step hold nothing; daughters inherit the parent's colour.
7. **Box2D baseline is not overlap-free either**: its random start leaves ~90 pairs crossed through
   each other for the whole run, and it never resolves them (see the overlap report).
8. **Memory still creeps up slowly** (~1 GB after 600 000 steps; see Performance). Runs of a few
   million steps in one process could approach the 4 GB WebAssembly limit. Options: a shorter
   `rapierRebuildInterval`, or re-creating the WebAssembly module from a saved state. Not
   investigated further. A crash still saves the snapshots recorded so far.
9. **Not done:** Web Worker for the physics in the browser; cross-machine determinism check.
