#!/usr/bin/env python3
"""Summarise overlap logs written by `run.js --overlap-log FILE` as Markdown.

usage: python3 bacteria/tools/overlap_report.py LOG.csv [LOG2.csv ...]
           [--warmup STEPS] [--target FRACTION] [--width CELL_WIDTH] [--every N]

For each log: a summary after the warm-up (worst and typical penetration, how many snapshots and
pairs exceed the target), then a time series sampled every N snapshots. Depths are capsule-capsule
penetration depths at full precision; percentages are of the cell width (2 * radius).
Standard library only.
"""

import argparse
import csv
import os
import statistics


def load(path):
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k in list(r):
            if k in ("step", "cells", "overlapping_pairs", "pairs_over_target"):
                r[k] = int(r[k])
            else:
                r[k] = float(r[k])
    return rows


def pct(depth, width):
    return f"{100 * depth / width:.2f}%"


def summarise(path, rows, args):
    w = args.width
    target = args.target * w
    after = [r for r in rows if r["step"] >= args.warmup]
    name = os.path.basename(path)
    out = [f"### {name}", ""]
    if not rows:
        return out + ["(empty log)", ""]
    out.append(f"{len(rows)} snapshots, steps {rows[0]['step']}–{rows[-1]['step']}, "
               f"{min(r['cells'] for r in rows)}–{max(r['cells'] for r in rows)} cells. "
               f"Target: max penetration < {args.target * 100:g}% of the cell width ({target:.3f}) "
               f"after the warm-up (step {args.warmup}).")
    out.append("")
    if not after:
        return out + ["No snapshots after the warm-up.", ""]
    worst = max(after, key=lambda r: r["max_depth"])
    over = [r for r in after if r["max_depth"] >= target]
    passed = not over
    out += [
        "| | |",
        "|---|---|",
        f"| Result | **{'PASS' if passed else 'FAIL'}** ({len(over)} of {len(after)} snapshots over the target) |",
        f"| Worst max penetration | {pct(worst['max_depth'], w)} at step {worst['step']} "
        f"(near x={worst['max_x']:.1f}, y={worst['max_y']:.1f}) |",
        f"| Max penetration, median over snapshots | {pct(statistics.median(r['max_depth'] for r in after), w)} |",
        f"| Mean penetration (over overlapping pairs), average | {pct(statistics.mean(r['mean_depth'] for r in after), w)} |",
        f"| 99th percentile, worst snapshot | {pct(max(r['p99_depth'] for r in after), w)} |",
        f"| Pairs over the target, total / per snapshot | {sum(r['pairs_over_target'] for r in after)} / "
        f"{statistics.mean(r['pairs_over_target'] for r in after):.2f} |",
        f"| Overlapping pairs per snapshot (any depth) | {statistics.mean(r['overlapping_pairs'] for r in after):.0f} |",
        f"| Worst cell–wall penetration | {pct(max(r['max_wall_depth'] for r in after), w)} |",
        "",
    ]
    out += ["| step | cells | overlapping pairs | max | mean | p99 | pairs over target | wall |",
            "|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for i, r in enumerate(rows):
        if i % args.every == 0 or r is rows[-1] or r is worst:
            mark = " **(worst)**" if r is worst else ""
            out.append(f"| {r['step']}{mark} | {r['cells']} | {r['overlapping_pairs']} | {pct(r['max_depth'], w)} | "
                       f"{pct(r['mean_depth'], w)} | {pct(r['p99_depth'], w)} | {r['pairs_over_target']} | "
                       f"{pct(r['max_wall_depth'], w)} |")
    out.append("")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--warmup", type=int, default=3000, help="steps excluded from the target (default 3000)")
    ap.add_argument("--target", type=float, default=0.05, help="max depth / cell width (default 0.05)")
    ap.add_argument("--width", type=float, default=0.8, help="cell width = 2 * radius (default 0.8)")
    ap.add_argument("--every", type=int, default=100, help="time series: every N-th snapshot (default 100)")
    args = ap.parse_args()
    lines = []
    for path in args.logs:
        lines += summarise(path, load(path), args)
    print("\n".join(lines))


if __name__ == "__main__":
    main()
