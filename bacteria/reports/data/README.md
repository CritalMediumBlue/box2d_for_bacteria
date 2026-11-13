# Overlap logs

One CSV row per snapshot (every 300 steps), written by `run.js --overlap-log`. Columns: step,
cells, overlapping pairs, max / mean / 99th-percentile cell-cell penetration depth, pairs over
the target (5% of the cell width = 0.04), max cell-wall depth, max depth as a fraction of the
width, and the locations of the deepest pair and the deepest wall contact. Summarise with
`python3 ../../tools/overlap_report.py FILE`, plot with `../../tools/overlap_chart.py`.

| File | Engine and settings | Seed, steps |
|---|---|---|
| `overlap-rapier-default-seed{7,11,23}-120k.csv` | Rapier, final defaults (12 iterations, 720 Hz, all fixes) | 7 / 11 / 23, 120 000 |
| `overlap-rapier-i12-f480-seed*-120k.csv` | Rapier, 12 iterations, 480 Hz | 7 / 11 / 23, 120 000 |
| `overlap-rapier-i8-f480-seed*-120k.csv` | Rapier, 8 iterations, 480 Hz | 7 / 11 / 23, 120 000 |
| `overlap-box2d-seed7-30k.csv` | Box2D, current defaults (centred division, drag clamp, 0.8x cells) | 7, 30 000 |
| `overlap-early-rapier4it30hz-contactfix-seed7-30k.csv` | Rapier's own solver defaults (4 iterations, 30 Hz) with the contact fix, before the triangle, drag-clamp and division fixes | 7, 30 000 |
| `overlap-early-rapier4it30hz-nocontactfix-seed7-22k.csv` | as above, without the contact fix (resizing colliders in place) | 7, ~22 000 |

The 600 000-step run's log is `overlap-rapier-default-seed7-600k.csv`.
