# Rapier port: notes

Overnight work log for porting the microfluidic biofilm simulation from the Box2D port to
[Rapier](https://rapier.rs) (`@dimforge/rapier2d-compat` 0.21.0, 2D, WebAssembly).

<!-- STATUS -->

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
apply to both engines (Box2D with `centredDivision=0 dragClamp=0` and the old drag values gives
output byte-identical to before the port; checked for seed 7, 3000 steps).

| Aspect | Box2D | Rapier | Notes |
|---|---|---|---|
| Cell shape | box + 2 circles | `capsule(length/2, radius)` | same outline, long axis = local y in both |
| Growth | vertices scaled in place | collider replaced with a longer one | see "Rapier contact bug" below |
| Mass / inertia | computed at birth, never updated | same values (`cellMassProperties`), set on the body; collider density 0 | Box2D counts the end caps' overlap with the box twice; kept |
| Drag | force −k·v once per fixture (3×) on growth steps, acts in the next step | the same velocity change as an impulse | plus `dragClamp`, see below |
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
25 000 steps). `tools/rapier-stale-contacts.mjs` is a minimal reproduction (worth reporting
upstream).

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
- Cell size 0.8× (your request): radius 0.4, initial length 2.4–4.8, division at 4.8 ± 1.0. Drag
  coefficients scaled by 0.8² (linear) and 0.8⁴ (angular) so each kick changes a cell's velocity
  by the same fraction as at the old size (mass ∝ area, inertia ∝ mass·length²).

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

So the default is 12 iterations with 720 Hz contacts. Contact stiffness costs no step time; more
iterations do, and beyond 12 they made things worse at 480 Hz (as 16 did at 240 Hz above).

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
  springs, and overlapping pairs highlighted: orange above 1% of the cell width, red above the 5%
  target. Use it with `view=minX,minY,maxX,maxY` (or `biofilm.setView(...)`) to zoom in.

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

| Cells | Rapier, defaults (12 it., 720 Hz) | Rapier, without the contact fix | Box2D |
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
Memory: <!-- MEM -->

**Browser** (headless Chrome 156 on the same machine, 1400×900 canvas): physics runs at the same
speed as in Node (12.5 ms/step at 1684 cells, measured in the page). Drawing takes ~1 ms of
script time per frame in the phase-contrast and fluorescence views (1700 cells) and ~28 ms in
the diagnostic view (capsule outlines plus the overlap measurement). The headless browser renders
on the CPU and showed only 16–22 fps even when paused, so its frame rates are not representative;
in a desktop browser with GPU canvas, 1 step per frame (12.5 + 1 ms) fits a 60 Hz frame, and
"Steps/frame" trades smoothness for speed (each extra step adds ~12 ms per frame at a full
chamber). Running the physics in a Web Worker would decouple the two (not done).

<!-- OVERLAP -->

## Rapier vs Box2D: colony organisation

Same seed (7), current model settings, averages over steps 15 000–30 000 (chamber full), from the
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
(Rapier, 120 000 steps) the centre stays aligned (+0.2 to +0.4) and the wall-zone cells tend to
lie across the chamber (⟨cos 2θ⟩ down to −0.27). Box2D was only run to 30 000 steps (it is
slow), so longer-term organisation was not compared.

## Worth reviewing / not done

1. **Rare overlap excursions remain.** With the defaults, a single pair occasionally exceeds the
   target for one snapshot (about 1 snapshot in 700 in the multi-seed runs, up to ~6% of the
   width). They are brief collisions at varying places, not a buildup. 16 iterations or stiffer
   contacts may remove them at more cost (see "Overlap results"). The count for the long run is
   in `reports/overlap-report.md`.
2. **Wall penetration under sustained pressure.** Not part of the stated target (pairwise), but
   measured: the deepest cell–wall contact per snapshot is typically ~14% of the cell width (cells
   pressed into the walls and between the small wall triangles, mostly in the dead-end top
   corners), and occasionally a cell's axis reaches the wall line (50%). Contacts there
   carry the colony's accumulated pressure. Isolated tests show the contacts themselves work; it
   is the solver's limit under that load. Options: more iterations, or a small contact skin on
   the walls (`ColliderDesc.setContactSkin`; untested), or reviewing why the pressure builds (next
   item).
3. **Anchors barely hold cells (both engines; a modelling question).** Anchors are 0.8 Hz springs
   (stiffness from the cell's mass), so once the chamber is full the colony drags anchored cells
   far from their anchor points: spring stretch at step 24 000 (seed 7), median / 90th percentile
   / max: Box2D 2.1 / 6.3 / 11.6 units, Rapier 1.4 / 3.8 / 8.3 (at step 12 000 both ~0.1). Stretched
   springs pull these cells back against the flow, adding stress in the wall zones, where most
   overlap excursions and the wall penetration happen. If anchors are meant to pin cells, a stiffer
   spring, a maximum stretch (detach), or a fixed joint would match that better.
4. **Rapier contact bug** (`tools/rapier-stale-contacts.mjs`): worth reporting to dimforge. If it
   is fixed upstream, `rapierRefreshContacts=0` saves 5–12% of the step time.
5. **Drag model.** Drag is still the testbed's kick every 25 steps (now clamped). A continuous
   damping would be smoother but changes the dynamics and needs recalibration.
6. **Kept testbed quirks**: mass fixed at birth (counts the end caps twice); anchors created for a
   cell that divides in the same step hold nothing; daughters inherit the parent's colour.
7. **Box2D baseline is not overlap-free either**: its random start leaves ~90 pairs crossed through
   each other for the whole run, and it never resolves them (see the overlap report).
