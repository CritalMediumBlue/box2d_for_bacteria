# Microfluidic biofilm simulation

Rod-shaped bacteria growing and dividing in a chamber. Runs on [Rapier](https://rapier.rs)
(default) or on the Box2D library in `../src` (the original implementation, kept for comparison).
See NOTES.md for the port: design decisions, differences from Box2D, performance and overlap results.

```
bacteria/
  src/model.ts              parameters (DEFAULT_PARAMS), chamber geometry, cell mass, the Simulation interface
  src/rapier-simulation.ts  the model on Rapier
  src/box2d-simulation.ts   the model on Box2D
  src/engines.ts            createSimulation(engine, params)
  src/overlap.ts            cell-cell and cell-wall penetration depth (overlap check)
  src/states.ts             state recording in the LowRes.json format
  src/rng.ts                seeded random numbers (same seed -> same run)
  src/run.ts                command-line runner (Node)
  src/render.ts             drawing (simple / diagnostic views), separate from physics
  src/viewer.ts             browser viewer
  index.html                viewer page
  tools/overlap_report.py   summarise an overlap log as Markdown
```

## Build

```sh
npm run build-bacteria      # builds the library (ES modules) and this folder
```

After changing only files in `bacteria/src`, `npm run watch-bacteria` rebuilds automatically.

## Run without a browser

```sh
npm run run-bacteria -- --steps 600000 --out states.json --seed 42
node bacteria/build/run.js --help              # all options
node bacteria/build/run.js --list-params       # all parameters and defaults
node bacteria/build/run.js --steps 30000 --set rate=0.002 --set anchorLifetimeSteps=6000
node bacteria/build/run.js --steps 30000 --engine box2d          # the original engine
node bacteria/build/run.js --steps 60000 --overlap-log overlap.csv --overlap-check
python3 bacteria/tools/overlap_report.py overlap.csv
```

- The file is rewritten in full every `--save-every` snapshots (default 500) and at the end, via a
  temporary file, so it is always complete and valid. Ctrl+C stops the run and saves.
- The seed is printed at the start; pass it again with `--seed` to reproduce a run exactly.
- Runs are independent, so several can run in parallel (one per CPU core).
- `--overlap-log` measures the penetration depth of every touching pair of cells (and of cells into
  the walls) at each snapshot, at full precision, and writes one CSV row per snapshot. The target is
  max depth < 8% of the cell width after a warm-up of 3000 steps (the random initial placement
  overlaps heavily); `--overlap-check` exits with status 3 if it is missed.

## Watch it in the browser

```sh
npm run start-bacteria      # serves the repo and opens bacteria/index.html
```

Space pauses, N steps once, J saves. In Chrome/Edge, J asks for a file once and then that file is
overwritten automatically every 500 snapshots; otherwise auto-save downloads numbered copies.

The header has the view style (simple: cell outlines, walls and joints as lines; diagnostic:
overlapping cells in orange, deeper than the target in red), the engine and the snapshot interval (both apply on
Restart), and shows the overlap at the last snapshot. URL parameters set the same things, plus any
simulation parameter: `index.html?engine=box2d&seed=7&style=diagnostic&speed=20&snapshotInterval=600`.
`window.biofilm` gives scripts the simulation, the latest overlap, timing, and `download()`.

## Output format (same as LowRes.json)

```json
{"1":[{"x":3.99,"y":166.12,"id":1,"an":0.46,"le":3.7}, ...], "2":[...], ..., "lineage":{"1":0, ...}}
```

- Snapshot keys count snapshots (every `snapshotInterval` = 300 steps, a multiple of `growthInterval` = 25); cells are sorted by id.
- `x`, `y`: cell centre. `an`: orientation as a fraction of π (0–1). `le`: distance between the
  end-cap centres (tip-to-tip length is `le + 2 * radius`). All rounded to 2 decimals.
- `id`: sequential, never reused. `lineage`: child id -> parent id (0 for the initial cells). Cells
  that divide or leave between two snapshots appear in `lineage` but in no snapshot.
