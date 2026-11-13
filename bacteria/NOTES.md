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

**Rapier contact bug (important).** In Rapier 0.21, a contact between two bodies that barely move
relative to each other keeps its old contact points, and resizing a collider
(`setHalfHeight`/`setShape`) does not refresh them. A cell at rest — most cells once the chamber is
full — then grows straight into its neighbours and the walls while the contact reports zero depth.
Overlap rose steadily once the chamber filled (mean penetration 0.2% → 6% of the width over
25 000 steps). Fix: each growth step replaces the cell's collider (`rapierRefreshContacts=1`), which
forces fresh contacts; it costs about 9% of the step time. `tools/rapier-stale-contacts.mjs` is a
minimal reproduction (worth reporting upstream).

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

<!-- SOLVER -->

<!-- BODY -->
