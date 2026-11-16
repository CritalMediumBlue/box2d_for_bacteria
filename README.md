# Microfluidic biofilm simulation

Rod-shaped bacteria growing, dividing and pushing each other as a monolayer in a microfluidic
chamber (100 × 60 units, open at the bottom). Cells near the side walls can attach to the surface.
The physics runs on [Rapier](https://rapier.rs) (default) or on the Box2D port this repository is
based on ([box2d.ts](https://github.com/flyover/box2d.ts), in `src/`).

**Live demo:** https://critalmediumblue.github.io/box2d_for_bacteria/bacteria/index.html

## Requirements

- Node.js 22 (tested with 22.23) and npm.
- Installed by npm: `@dimforge/rapier2d-compat` **0.21.0** (pinned exactly, because results
  depend on the physics engine version), TypeScript 5.x, `http-server` 14.
- Optional: Python 3 for the analysis scripts in `bacteria/tools/` (standard library only).

## Build

```sh
git clone https://github.com/CritalMediumBlue/box2d_for_bacteria.git
cd box2d_for_bacteria
npm install
npm run build-bacteria        # compiles the Box2D library (build/esm/) and the simulation (bacteria/build/)
```

## Run

**In the browser:** `npm run start-bacteria` serves the repository and opens `bacteria/index.html`.
Space pauses, N advances one step, J saves the states. URL parameters set the engine, the seed,
the view, the steps per frame and any model parameter, e.g.
`bacteria/index.html?seed=7&speed=20&style=diagnostic&anchorMaxStretch=1`.

**On the command line:**

```sh
node bacteria/build/run.js --steps 600000 --seed 7 --out output/states.json
node bacteria/build/run.js --help             # all options
node bacteria/build/run.js --list-params      # all model parameters and their defaults
node bacteria/build/run.js --steps 30000 --set rate=0.002 --set anchorMaxStretch=1   # override parameters
node bacteria/build/run.js --steps 30000 --engine box2d                             # the original engine
```

Other options: `--save-every N` (snapshots between saves, default 500), `--overlap-log FILE`
(cell–cell penetration per snapshot, as CSV; summarise with
`python3 bacteria/tools/overlap_report.py FILE`), `--timing-log FILE`. Progress and the seed are
printed to stderr.

## Saved states

- **Command line:** written to `--out` (default `states.json`; folders are created). The file is
  rewritten in full every `--save-every` snapshots and at the end, so it is always valid JSON.
  Ctrl+C stops the run and saves.
- **Browser:** J or "Save states…" saves `states.json`. In Chrome/Edge you pick the file once and
  it is then overwritten automatically every 500 snapshots; other browsers download numbered copies.
- **Format** (one snapshot every `snapshotInterval` = 300 steps):
  ```json
  {"1":[{"x":3.99,"y":166.12,"id":1,"an":0.46,"le":3.7}, ...], "2":[...], ..., "lineage":{"1":0, ...}}
  ```
  `x`, `y`: cell centre; `an`: orientation as a fraction of π; `le`: distance between the end-cap
  centres (cell length = `le` + 0.8); values rounded to 2 decimals. `lineage` maps each cell id to
  its mother's id (0 for the initial cells).
- **Resume / replay:** a run cannot be resumed from a states file: the file stores rounded
  positions, not the full physics state. To reproduce a run, run it again with the same seed and
  parameters. `bacteria/tools/organization.py FILE` computes cell counts and alignment from a
  states file.

## Reproducibility

- The same seed, parameters, engine and machine give a byte-identical states file (checked: two
  runs of `--steps 3000 --seed 42`). Without `--seed` a random seed is used and printed.
  Results differ between the Rapier and Box2D engines, and possibly between machines (not tested).
- Defaults: 1000 initial cells, 60 steps per simulated second, cell width 0.8, growth every 25
  steps, 8 Rapier solver iterations. See `--list-params`; each parameter is documented in
  `bacteria/src/model.ts`.
- Expected output: `--steps 3000` gives 10 snapshots and ~960 cells. The chamber fills after
  ~12 000 steps and then holds ~1700–1800 cells. 600 000 steps take ~1 h 40 min on one core
  (Xeon E-2246G) and give a ~190 MB file with 2000 snapshots.

Model choices, validation and performance are documented in [`bacteria/NOTES.md`](bacteria/NOTES.md)
and [`bacteria/reports/overlap-report.md`](bacteria/reports/overlap-report.md).

## License

MIT, see `LICENSE` (inherited from Box2D / box2d.ts).
