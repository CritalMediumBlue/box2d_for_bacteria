# Overlap logs

One CSV row per snapshot (every 300 steps), written by `run.js --overlap-log`. Columns: step,
cells, overlapping pairs, max / mean / 99th-percentile cell-cell penetration depth, pairs over
the target (5% of the cell width = 0.04), max cell-wall depth, max depth as a fraction of the
width, and the locations of the deepest pair and the deepest wall contact. Summarise with
`python3 ../../tools/overlap_report.py FILE`, plot with `../../tools/overlap_chart.py`.

| File | Engine and settings | Seed, steps |
|---|---|---|
| `overlap-rapier-anchorstretch2-seed*-120k.csv` | **Rapier, final defaults**: 12 iterations, 720 Hz, colliders replaced on growth + world rebuilt every 10 000 steps, all model fixes, anchors let go at 2 units (`anchorMaxStretch=2`) | 7 / 11 / 23, 120 000 |
| `overlap-rapier-anchorstretch1-seed*-120k.csv` | as default, anchors let go at 1 unit | 7 / 11 / 23, 120 000 |
| `overlap-rapier-anchorhold-seed{7,11,23}-120k.csv` | as default, but anchors never let go (`anchorMaxStretch=0`, the testbed's behaviour; the default until 14 November) | 7 / 11 / 23, 120 000 |
| `overlap-rapier-anchorhold-seed7-600k.csv` | as above, the overnight long run | 7, 600 000 |
| `overlap-rapier-replace-norebuild-seed*-120k.csv` | anchors never let go, and no world rebuilds (leaks memory; a run this way aborted at step ~231 500) | 7 / 11 / 23, 120 000 |
| `overlap-rapier-flip-seed*-120k.csv` | anchors never let go, and contacts refreshed by turning colliders by π (`rapierRefreshContacts=2`) | 7 / 11 / 23, 120 000 |
| `overlap-rapier-i12-f480-seed*-120k.csv` | 12 iterations, 480 Hz (no rebuilds; anchors never let go, as in all rows below) | 7 / 11 / 23, 120 000 |
| `overlap-rapier-i8-f480-seed*-120k.csv` | 8 iterations, 480 Hz (no rebuilds) | 7 / 11 / 23, 120 000 |
| `overlap-box2d-seed7-30k.csv` | Box2D, centred division, drag clamp, 0.8x cells, anchors never let go | 7, 30 000 |
| `overlap-early-rapier4it30hz-contactfix-seed7-30k.csv` | Rapier's own solver defaults (4 iterations, 30 Hz) with the contact fix, before the triangle, drag-clamp and division fixes | 7, 30 000 |
| `overlap-early-rapier4it30hz-nocontactfix-seed7-22k.csv` | as above, without the contact fix (resizing colliders in place) | 7, ~22 000 |

| `overlap-box2d-anchorstretch2-seed7-30k.csv` | Box2D with the final model defaults (anchors let go at 2 units) | 7, 30 000 |
<!-- NEW-RUNS -->
