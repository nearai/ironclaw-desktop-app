#!/usr/bin/env python3
"""
Generate the menu-bar tray icons for IronClaw.

Three colored PNGs are emitted (cyan / gold / dim-red), one per connection
state. The Rust side swaps between them via `tray.set_icon(...)` whenever
the JS connection store calls `update_tray_status`.

We deliberately do NOT use a single macOS Template image + tint-overlay:
- macOS templates collapse to white-on-black in light/dark menu bars,
  which loses the colour signal entirely. We want three distinct hues
  that "leak through" the tint so the user reads state at a glance.
- The bitmap is rendered at 64x64 (32pt @2x), the size macOS expects in
  the menu bar. Tauri's tray-icon crate clamps the image down for us if
  the OS picks a smaller slot.

Rendering uses Pillow only — no cairosvg dependency — so this works in
the system Python without a venv. The glyph is a simplified version of
the main icon: three short curved tick-marks arranged in a 120-degree
fan, with a single tiny accent dot at the top.

Run from inside src-tauri/icons/tray/ (the script anchors paths off
__file__ so any cwd works).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw  # type: ignore
except ImportError:
    sys.exit("Pillow not available; install with `pip3 install --user Pillow`")

HERE = Path(__file__).resolve().parent

# 32x32 @2x = 64x64 effective. macOS will downscale if a smaller slot
# is needed; we never go below this to keep the menu-bar rendering sharp.
SIZE = 64

# (name, fill RGB) — alpha comes from the draw mask.
VARIANTS: list[tuple[str, tuple[int, int, int]]] = [
    ("tray-connected.png", (0, 212, 255)),   # accent-cyan
    ("tray-connecting.png", (251, 191, 36)),  # accent-gold
    ("tray-disconnected.png", (160, 160, 168)),  # dim grey (neutral, not alarming)
]


def draw_claw(size: int, color: tuple[int, int, int]) -> Image.Image:
    """Render one claw glyph in `color` at `size`x`size` RGBA.

    Geometry: three short arc-segments evenly spaced 120 degrees apart,
    pointing outward from a small dotted centre. The stroke width is
    proportional to size so the glyph keeps its weight at every scale.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = cy = size / 2
    # Outer radius for the talons; the arc traces an annulus from r_inner
    # to r_outer so the marks read as claws, not lines.
    r_outer = size * 0.42
    r_inner = size * 0.20
    stroke = max(2, int(size * 0.11))

    # Three talons, starting at top (-90 deg) and rotating clockwise.
    # Each talon is a short arc drawn between two `pieslice` outlines
    # then masked to a tick-mark width by re-drawing in transparent.
    # For simplicity we draw an arc segment via PIL's `arc` primitive.
    bbox = (cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer)
    # Each talon occupies a 60-degree arc centred on its base angle.
    for base_deg in (-90.0, 30.0, 150.0):
        start = base_deg - 28.0
        end = base_deg + 28.0
        draw.arc(bbox, start=start, end=end, fill=color + (255,), width=stroke)

    # Small inner dot tying the three talons together — same accent
    # colour, slightly translucent, sized relative to the glyph.
    dot_r = size * 0.07
    draw.ellipse(
        (cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r),
        fill=color + (220,),
    )

    # Single tiny "tip" glint on the top talon to echo the main app icon's
    # gold accent. Always white-ish so it reads at small sizes; the color
    # is the claw's own colour at full alpha so it stays harmonious.
    tip_r = max(1, int(size * 0.045))
    tip_y = cy - r_outer
    draw.ellipse(
        (cx - tip_r, tip_y - tip_r, cx + tip_r, tip_y + tip_r),
        fill=(255, 255, 255, 240),
    )

    return img


def main() -> None:
    print(f"rendering 3 tray icons at {SIZE}x{SIZE} into {HERE}")
    for name, color in VARIANTS:
        img = draw_claw(SIZE, color)
        out = HERE / name
        img.save(out, format="PNG")
        print(f"  wrote {out.name} ({color[0]:02x}{color[1]:02x}{color[2]:02x}, "
              f"{out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
