#!/usr/bin/env python3
"""Colony organisation over time from exported states files (LowRes.json format), to compare runs
(e.g. Rapier vs Box2D). Standard library only.

usage: python3 bacteria/tools/organization.py STATES.json [STATES2.json ...] [--every N] [--from STEP] [--to STEP]
           [--snapshot-interval 300] [--wall-zone 20]

Per sampled snapshot: number of cells, mean length (le), nematic order S = |<exp(2iθ)>| (0 = random
orientations, 1 = all parallel), and vertical alignment <cos 2θ> (+1 = all cells along y, i.e.
pointing at the exit; -1 = all along x), overall and separately for the wall zones (within
--wall-zone of the side walls) and the centre. θ = an·π (an = 0 is a cell along y). With --from,
also the averages over all snapshots from that step on.
"""

import argparse
import json
import math
import os


def stats(cells):
    if not cells:
        return dict(n=0, le=float("nan"), S=float("nan"), c2=float("nan"))
    c = sum(math.cos(2 * math.pi * x["an"]) for x in cells) / len(cells)
    s = sum(math.sin(2 * math.pi * x["an"]) for x in cells) / len(cells)
    return dict(n=len(cells), le=sum(x["le"] for x in cells) / len(cells), S=math.hypot(c, s), c2=c)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("states", nargs="+")
    ap.add_argument("--every", type=int, default=20, help="print every N-th snapshot (default 20)")
    ap.add_argument("--from", dest="start", type=int, default=None, help="also average from this step on")
    ap.add_argument("--to", dest="end", type=int, default=None, help="... up to this step (default: the end)")
    ap.add_argument("--snapshot-interval", type=int, default=300)
    ap.add_argument("--wall-zone", type=float, default=20.0)
    ap.add_argument("--min-x", type=float, default=-50.0)
    ap.add_argument("--max-x", type=float, default=50.0)
    a = ap.parse_args()
    for path in a.states:
        with open(path) as f:
            data = json.load(f)
        data.pop("lineage", None)
        keys = sorted(data, key=int)
        print(f"### {os.path.basename(path)}  ({len(keys)} snapshots)\n")
        print("| step | cells | mean le | S all | <cos2θ> all | <cos2θ> centre | <cos2θ> wall zones | S centre | S wall zones |")
        print("|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
        acc = []
        for i, k in enumerate(keys):
            cells = data[k]
            step = int(k) * a.snapshot_interval
            wall = [c for c in cells if c["x"] < a.min_x + a.wall_zone or c["x"] > a.max_x - a.wall_zone]
            centre = [c for c in cells if not (c["x"] < a.min_x + a.wall_zone or c["x"] > a.max_x - a.wall_zone)]
            al, ce, wa = stats(cells), stats(centre), stats(wall)
            row = (step, al["n"], al["le"], al["S"], al["c2"], ce["c2"], wa["c2"], ce["S"], wa["S"])
            if a.start is not None and step >= a.start and (a.end is None or step <= a.end):
                acc.append(row)
            if i % a.every == 0 or i == len(keys) - 1:
                print("| %d | %d | %.2f | %.3f | %+.3f | %+.3f | %+.3f | %.3f | %.3f |" % row)
        if acc:
            avg = [sum(r[j] for r in acc) / len(acc) for j in range(1, 9)]
            span = f"{a.start}–{a.end}" if a.end is not None else f"from {a.start}"
            print("| **mean %s** (%d snapshots) | %.0f | %.2f | %.3f | %+.3f | %+.3f | %+.3f | %.3f | %.3f |"
                  % (span, len(acc), *avg))
        print()


if __name__ == "__main__":
    main()
