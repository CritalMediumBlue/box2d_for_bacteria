# Overlap report: Rapier port

**Summary.** With the final defaults, the deepest cell–cell penetration stays below the target
of 5% of the cell width in **99.0%** of snapshots over a 600 000-step run (1971 of 1991 after
the warm-up) and in 99.5% of the 3-seed × 120 000-step validation. A typical full-chamber snapshot
(~1740 cells, ~2700 touching pairs) has its deepest pair at ~1% of the width and a mean of 0.2%.
The target is **not** met at every snapshot. The exceptions are single pairs (two in three
snapshots), each for one snapshot, up to 20.8%. They come from anchor springs that the colony
has stretched by several units. Letting anchors detach beyond a maximum stretch
(`anchorMaxStretch=1` or `2`) removes them (0 of 2346 snapshots, worst 3.4%) but changes the
colony's organisation, so it is left off pending a modelling decision. Box2D, measured the same
way, is over the target in 86 of 91 snapshots.

## What is measured

At every snapshot (every 300 steps) the runner measures, on the live simulation at full precision:

- **cell–cell penetration depth** for every pair of touching cells. Each cell is a capsule: the
  segment between its end-cap centres, swept by the radius. Two cells overlap by
  `2·radius − distance(axis₁, axis₂)` when that is positive. Pairs are found with a uniform grid
  (cell size = longest cell + 2·radius), so every touching pair is tested exactly once.
- per snapshot: the **max**, the **mean over overlapping pairs**, the **99th percentile**, the
  number of overlapping pairs and of pairs deeper than the target, and where the deepest pair is;
- **cell–wall penetration**: the deepest any cell axis comes within one radius of the side and top
  walls or of the small wall triangles (a cell axis crossing a wall counts as one radius).

The exported states cannot be used for this: they are rounded to 2 decimals and `an` to 0.01·π,
which alone moves a cell tip by up to ~0.03 (4% of the width).

**Target:** max cell–cell penetration < 5% of the cell width (0.040 for width 0.8) at every
snapshot after a **warm-up of 3000 steps**. The initial 1000 cells are placed at random and
overlap heavily (pairs crossing each other completely); Rapier separates them in ~1500–3000 steps.
Resting contacts always sit slightly inside each other (~0.1–0.5% of the width): Rapier's allowed
penetration and soft contacts.

Tools: `run.js --overlap-log FILE [--overlap-check]`, `tools/overlap_report.py` (tables),
`tools/overlap_chart.py` (charts), and in the browser the overlap readout and the diagnostic view.

## Final defaults on three seeds (120 000 steps each)

Rapier with the final defaults (12 solver iterations, 720 Hz contact stiffness, colliders
replaced on growth with the world rebuilt every 10 000 steps, all model fixes), seeds 7, 11 and
23. Statistics over the 391 snapshots after the warm-up (step 3000–120 000) of each run;
percentages of the cell width.

| Seed | Snapshots over the target | Worst max | Median max | Mean (overlapping pairs) | Worst 99th pct | Wall: median / worst |
|---|---|---|---|---|---|---|
| 7 | 2 / 391 | 20.8% | 0.99% | 0.19% | 0.81% | 12% / 50% |
| 11 | 2 / 391 | 6.8% | 0.97% | 0.19% | 0.83% | 15% / 50% |
| 23 | 2 / 391 | 10.2% | 0.98% | 0.19% | 0.81% | 12% / 50% |

![seed 7](charts/overlap-default-seed7-120k.svg)
![seed 11](charts/overlap-default-seed11-120k.svg)
![seed 23](charts/overlap-default-seed23-120k.svg)

Typical state once the chamber is full (~1700–1760 cells, ~2700 touching pairs): mean penetration
0.2% of the width, 99% of contacts below 0.8%, the deepest pair around 1%. The target is met in
**99.5%** of snapshots; each exception is a single pair for one or two snapshots.

## Where the exceptions come from

Traced one (seed 7, step 65 700, 20.8%): two cells in the wall zone, each held by two anchor
springs stretched by 3–8 units. Anchors are 0.8 Hz springs (as in the testbed), too soft to hold a
cell, so once the chamber is full the colony drags anchored cells several units away; the
stretched spring then pulls back with ~ω²·stretch ≈ 160 units/s² (stretch 6), far above anything
else acting on a cell. The two cells jitter against their neighbours at ~1 unit/s; one spins up
from 0.04 to 5 rad/s within 9 steps and lands 0.17 inside the other, and the solver pushes it out
over the next steps.

**Check:** with `anchorMaxStretch` (an anchor lets go when its cell is farther than this from the
anchor point; off by default) the exceptions disappear:

| Run (3 seeds × 120 000 steps) | Snapshots over the target | Worst max | Wall: median |
|---|---|---|---|
| defaults | 2 / 2 / 2 of 391 | 20.8% | 12–15% |
| `anchorMaxStretch=2` | **0 / 0 / 0** of 391 | 3.4% | 4–5% |
| `anchorMaxStretch=1` | **0 / 0 / 0** of 391 | 3.4% | 2% |

It also changes the colony's organisation (centre alignment ⟨cos 2θ⟩ +0.30 → +0.52 / +0.56), so it
is a modelling decision, not a solver setting, and the default keeps the testbed's anchors. See
NOTES.md ("Worth reviewing").

## Other settings and Box2D (same measurement)

| Run | Snapshots over the target | Worst max | Median max | Mean | Worst 99th pct |
|---|---|---|---|---|---|
| Rapier, defaults but **no world rebuild** (leaks memory), seeds 7 / 11 / 23 | 0 / 0 / 0 of 391 | 4.9% | 1.0% | 0.19% | 0.8% |
| Rapier, defaults but contacts refreshed by turning colliders by π | 2 / 2 / 8 of 391 | 11.2% | 1.0% | 0.19% | 0.9% |
| Rapier, 12 it., 480 Hz (no rebuild) | 2 / 0 / 1 of 391 | 8.7% / 4.3% / 100%¹ | 1.0% | 0.20% | 0.9% |
| Rapier, 8 it., 480 Hz (no rebuild) | 6 / 3 / 9 of 391 | 13.6% | 1.3–1.5% | 0.21% | 1.3% |
| Rapier, Rapier's own solver defaults (4 it., 30 Hz), before the other fixes, seed 7, 30 000 steps | 62 / 91 | 100% | 15.6% | 1.7% | 27% |
| **Box2D** (current model settings), seed 7, 30 000 steps | **86 / 91** | 100% | 38.8% | 6.8% | 100% |

¹ a pair that crossed at the random start and separated only after the warm-up.

Without world rebuilds there were no exceptions (0 of 1173 vs 6 of 1173 with rebuilds). The runs
follow different trajectories after the first rebuild (step 10 000) and the events are rare, but
0 vs 6 is unlikely to be pure chance (p ≈ 0.03), so the rebuild may contribute, e.g. through the
contact and spring caches starting cold (positions, angles, velocities, masses and springs are
carried over exactly). It does not cause exceptions on its own: the `anchorMaxStretch` runs also
rebuild every 10 000 steps and had none in 2346 snapshots. Running without rebuilds is not an
option for long runs (memory; see NOTES.md).

The Box2D port is far from the target: its random start leaves pairs crossed through each other
for the whole run (it never separates them), and once the chamber fills its packing is denser
(~1850–1940 cells vs ~1700–1760 in Rapier) with ~340 pairs per snapshot deeper than the target.

## Cell–wall penetration

Not part of the target (pairwise), but measured. With the defaults the deepest cell–wall contact
per snapshot is typically ~12–15% of the width, in the dead-end top corners and between the small
wall triangles, where anchored cells and the colony's pressure end; occasionally a cell's axis
reaches a wall line (50%). With `anchorMaxStretch` it drops to 2–5% (see above).

## Long run: 600 000 steps (seed 7, final defaults)

`node bacteria/build/run.js --steps 600000 --seed 7 --overlap-log …` took 2 h 32 min and
exported 2000 snapshots (`bacteria/output/states-rapier-600k-seed7.json`, 187 MB, 105 172 cell
ids; not in git). Log: `data/overlap-rapier-default-seed7-600k.csv`.

| | |
|---|---|
| Snapshots after the warm-up | 1991 |
| Over the target | **20** (1.0%); each one pair, two pairs in 3 snapshots, 23 pairs in total |
| Worst max | 20.8% (step 65 700) |
| Max per snapshot: median / 99th percentile | 1.02% / 5.0% |
| Mean over overlapping pairs (average) | 0.19% |
| Worst 99th percentile of pair depths in a snapshot | 0.87% |
| Overlapping pairs per snapshot | ~2700 |
| Cells once full (step > 30 000) | 1687–1790, mean 1740 |
| Cell–wall: median / 90th percentile / worst | 15% / 35% / 50% |

![seed 7, 600 000 steps](charts/overlap-default-seed7-600k.svg)

The exceptions, by 120 000-step window: 2, 1, 12, 4, 1. 15 of the 20 are under 10%; the worst
five are 20.8%, 16.4%, 15.9%, 12.7% and 11.1%. All are in the upper part of the chamber
(y 149–198), mostly near the side walls, where anchored cells sit. Between exceptions the
statistics stay flat for the whole run, with no drift in the median, mean or 99th percentile. The
first 120 000 steps are byte-identical to the seed-7 validation run above, so world rebuilds do
not break determinism.

The colony's organisation is steady too (`tools/organization.py`, averages per 120 000-step window):
centre ⟨cos 2θ⟩ +0.30 ± 0.01, wall zones −0.19 to −0.14, mean length 2.90–2.92.

## Browser screenshots

A 60 000-step session in headless Chrome (`index.html?seed=7`, 200 steps per frame), paused every
~6000 steps for screenshots: the whole chamber in the phase-contrast and diagnostic views, and
diagnostic close-ups (~18 × 11 units) around the deepest pair at the last snapshot and of the
top-left corner. In the diagnostic view each cell has its true capsule outline; pairs deeper than
1% of the width are drawn orange, deeper than the target red. At the close-up zoom one pixel is
~0.013 units, so a 5% overlap (0.04) would show as ~3 pixels of outline crossing a neighbour.

Readouts at each pause (overlap at the last snapshot; `screenshots/browser-session.log`): max
2.1% at step 6200, then 0.84–1.56% at every pause up to step 60 400; mean 0.16–0.21%. No red
pairs, a few orange ones; no visible overlap in the phase-contrast images or the close-ups. Wall
close-ups show cells packed against the wall teeth, consistent with the measured wall depth.

(This session ran before world rebuilds were added; the rebuild was checked separately in the
browser: seed 11 to step 21 400, two rebuilds, no errors, max 1.0%.)

| | |
|---|---|
| ![phase, step 12 400](screenshots/step-012400-phase.jpg) | ![diagnostic, step 12 400](screenshots/step-012400-diagnostic.jpg) |
| ![phase, step 60 400](screenshots/step-060400-phase.jpg) | ![diagnostic, step 60 400](screenshots/step-060400-diagnostic.jpg) |
| ![close-up around the deepest pair, step 42 400](screenshots/step-042400-zoom-deepest.jpg) | ![close-up of the top-left corner, step 36 400](screenshots/step-036400-zoom-corner.jpg) |
| ![close-up around the deepest pair, step 60 400](screenshots/step-060400-zoom-deepest.jpg) | ![close-up of the top-left corner, step 60 400](screenshots/step-060400-zoom-corner.jpg) |
| ![fluorescence view, step 24 000](screenshots/step-024000-fluorescence.jpg) | ![the page with controls and overlap readout](screenshots/step-024000-fluorescence-page.jpg) |

The session also downloaded the states through the page's own `download()`: 17.5 MB, 205
snapshots, 10 954 cell ids, valid `LowRes.json`.
