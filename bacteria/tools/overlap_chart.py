#!/usr/bin/env python3
"""Plot an overlap log (run.js --overlap-log) as an SVG line chart: max, 99th percentile and mean
cell-cell penetration per snapshot, as % of the cell width, with the target line and the warm-up
shaded. Standard library only; light and dark colours follow the viewer's colour scheme.

usage: python3 bacteria/tools/overlap_chart.py LOG.csv OUT.svg [--title TEXT] [--warmup STEPS]
           [--target FRACTION] [--width CELL_WIDTH] [--ymax PERCENT]
"""

import argparse
import csv
import html

W, H = 900, 380
M = {"left": 64, "right": 120, "top": 52, "bottom": 52}

STYLE = """
  .surface { fill: #fcfcfb; } .title { fill: #0b0b0b; } .label, .tick { fill: #52514e; }
  .grid { stroke: #e4e3df; } .axis { stroke: #b9b8b2; } .warmup { fill: #efeee9; }
  .target { stroke: #52514e; } .s1 { stroke: #2a78d6; } .s2 { stroke: #eb6834; } .s3 { stroke: #1baf7a; }
  .k1 { fill: #2a78d6; } .k2 { fill: #eb6834; } .k3 { fill: #1baf7a; }
  @media (prefers-color-scheme: dark) {
    .surface { fill: #1a1a19; } .title { fill: #f0efec; } .label, .tick { fill: #c3c2b7; }
    .grid { stroke: #2f2f2d; } .axis { stroke: #5a5955; } .warmup { fill: #252524; }
    .target { stroke: #c3c2b7; } .s1 { stroke: #3987e5; } .s2 { stroke: #d95926; } .s3 { stroke: #199e70; }
    .k1 { fill: #3987e5; } .k2 { fill: #d95926; } .k3 { fill: #199e70; }
  }
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
"""


def nice_step(span, target_ticks):
    raw = span / max(1, target_ticks)
    mag = 10 ** len(str(int(raw))) / 10 if raw >= 1 else 1
    for m in (1, 2, 2.5, 5, 10):
        if raw <= m * mag:
            return m * mag
    return 10 * mag


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("log"); ap.add_argument("out")
    ap.add_argument("--title", default="Cell–cell penetration per snapshot")
    ap.add_argument("--warmup", type=int, default=3000)
    ap.add_argument("--target", type=float, default=0.05)
    ap.add_argument("--width", type=float, default=0.8)
    ap.add_argument("--ymax", type=float, default=None, help="y axis maximum in %% (default: max after warm-up, at least 1.2 x target)")
    a = ap.parse_args()

    rows = list(csv.DictReader(open(a.log, newline="")))
    steps = [int(r["step"]) for r in rows]
    series = [
        ("max", "s1", "k1", [100 * float(r["max_depth"]) / a.width for r in rows]),
        ("99th pct", "s2", "k2", [100 * float(r["p99_depth"]) / a.width for r in rows]),
        ("mean", "s3", "k3", [100 * float(r["mean_depth"]) / a.width for r in rows]),
    ]
    after = [v for s, v in zip(steps, series[0][3]) if s >= a.warmup]
    ymax = a.ymax or max(1.25 * 100 * a.target, max(after or [0]) * 1.1)
    xmax = steps[-1]
    pw, ph = W - M["left"] - M["right"], H - M["top"] - M["bottom"]
    X = lambda s: M["left"] + pw * s / xmax
    Y = lambda v: M["top"] + ph * (1 - min(v, ymax) / ymax)

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
           f'aria-label="{html.escape(a.title)}"><style>{STYLE}</style>',
           f'<rect class="surface" width="{W}" height="{H}" rx="6"/>',
           f'<text class="title" x="{M["left"]}" y="26" font-size="16" font-weight="600">{html.escape(a.title)}</text>',
           f'<text class="label" x="{M["left"]}" y="44" font-size="12">% of the cell width; values above {ymax:.1f}% are drawn at the top edge</text>']
    # warm-up band
    out.append(f'<rect class="warmup" x="{X(0):.1f}" y="{M["top"]}" width="{X(a.warmup) - X(0):.1f}" height="{ph}"/>')
    out.append(f'<text class="label" x="{X(0) + 4:.1f}" y="{M["top"] + ph - 8}" font-size="11">warm-up</text>')
    # grid + y ticks
    ystep = nice_step(ymax, 5)
    v = 0.0
    while v <= ymax + 1e-9:
        out.append(f'<line class="grid" x1="{M["left"]}" x2="{M["left"] + pw}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke-width="1"/>')
        out.append(f'<text class="tick" x="{M["left"] - 8}" y="{Y(v) + 4:.1f}" font-size="11" text-anchor="end">{v:g}%</text>')
        v += ystep
    # x ticks
    xstep = nice_step(xmax, 8)
    s = 0
    while s <= xmax:
        label = f"{s / 1000:g}k" if s else "0"
        anchor = "end" if X(s) > M["left"] + pw - 12 else "middle"  # keep the last tick clear of the end labels
        out.append(f'<text class="tick" x="{X(s):.1f}" y="{M["top"] + ph + 18}" font-size="11" text-anchor="{anchor}">{label}</text>')
        s += xstep
    out.append(f'<text class="label" x="{M["left"] + pw / 2:.1f}" y="{H - 12}" font-size="12" text-anchor="middle">simulation step</text>')
    out.append(f'<line class="axis" x1="{M["left"]}" x2="{M["left"] + pw}" y1="{M["top"] + ph}" y2="{M["top"] + ph}" stroke-width="1"/>')
    # target
    ty = Y(100 * a.target)
    out.append(f'<line class="target" x1="{M["left"]}" x2="{M["left"] + pw}" y1="{ty:.1f}" y2="{ty:.1f}" stroke-width="1.5" stroke-dasharray="6 4"/>')
    out.append(f'<text class="label" x="{M["left"] + pw - 4}" y="{ty - 6:.1f}" font-size="11" text-anchor="end">target: max &lt; {100 * a.target:g}%</text>')
    # series (drawn mean first so max is on top), direct labels at the right end, nudged apart
    ends = []
    for name, cls, key, vals in reversed(series):
        pts = " ".join(f"{X(st):.1f},{Y(val):.1f}" for st, val in zip(steps, vals))
        out.append(f'<polyline class="{cls}" fill="none" stroke-width="2" stroke-linejoin="round" points="{pts}"/>')
        ends.append([Y(vals[-1]), name, key, vals[-1]])
    # nudge apart upwards from the axis, so no end label drops below the plot
    ends.sort(reverse=True)
    ends[0][0] = min(ends[0][0], M["top"] + ph)
    for i in range(1, len(ends)):
        if ends[i - 1][0] - ends[i][0] < 14:
            ends[i][0] = ends[i - 1][0] - 14
    for y, name, key, val in ends:
        out.append(f'<circle class="{key}" cx="{M["left"] + pw + 12}" cy="{y - 4:.1f}" r="4"/>')
        out.append(f'<text class="label" x="{M["left"] + pw + 20}" y="{y:.1f}" font-size="11">{name} {val:.2f}%</text>')
    out.append("</svg>")
    open(a.out, "w").write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
