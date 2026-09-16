#!/usr/bin/env python3
"""
Turn a screenshot delivery into an ordered, flattened upload bundle.

    python3 scripts/prep-appstore-upload.py <source-folder> [<out-folder>]

Two jobs, both of which have bitten this project before:

  ORDER   App Store Connect uploads in whatever order it receives, and the
          delivered filenames are design-order, not ship-order. The ship order
          is decided in docs/app-store/screenshot-v4-fix-directive.md §3 and
          lives here as ORDER, so nobody re-derives it from a filename.

  FLATTEN Deliveries come out RGBA. Apple's spec says screenshots carry no
          alpha. The v3 set shipped RGBA and Apple took it, so this has never
          bitten us — but flattening costs nothing when the alpha is fully
          opaque, and this refuses to flatten silently when it is not.

Output is <out>/NN-<name>.png, numbered by slot, plus manifest.txt.
"""

import os
import shutil
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("pillow is required:  pip install pillow --break-system-packages")

# Ship order — fix-directive §3. Slot 1 leads with an actual outfit because
# the whole paid channel is the keyword [outfit planner].
ORDER = [
    "01-hook",     # "Your closet. Styled."      — the outfit, on Today
    "02-ten",      # "Start with just ten pieces" — the wedge
    "03-closet",   # "Every piece, remembered"    — the utility claim
    "04-stylist",  # the stylist, deliberately below the fold
    "05-friends",  # "Get dressed together"       — the one thing nobody else has
    "06-plan",     # "Packed before you are"
    "00-cover",    # the brand card, as a closing statement
]

EXPECTED_SIZE = (1320, 2868)


def main(src: str, out: str) -> int:
    if not os.path.isdir(src):
        return fail(f"not a folder: {src}")

    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)

    manifest, missing = [], []

    for slot, stem in enumerate(ORDER, start=1):
        path = os.path.join(src, f"{stem}.png")
        if not os.path.exists(path):
            missing.append(stem)
            continue

        im = Image.open(path)
        if im.size != EXPECTED_SIZE:
            return fail(f"{stem}: {im.size}, expected {EXPECTED_SIZE}")

        if "A" in im.mode:
            lo, hi = im.convert("RGBA").getchannel("A").getextrema()
            if (lo, hi) != (255, 255):
                return fail(
                    f"{stem}: alpha is not fully opaque ({lo}..{hi}). Flattening would "
                    "change the image. Fix the export instead of guessing a matte."
                )

        dest_name = f"{slot:02d}-{stem.split('-', 1)[1]}.png"
        im.convert("RGB").save(os.path.join(out, dest_name), "PNG")
        manifest.append(f"{slot}  {dest_name:20s} <- {stem}.png")
        print(f"  slot {slot}  {dest_name:20s} <- {stem}.png")

    if missing:
        return fail("missing from the delivery: " + ", ".join(missing))

    with open(os.path.join(out, "manifest.txt"), "w") as fh:
        fh.write("App Store screenshot upload bundle\n")
        fh.write("order: docs/app-store/screenshot-v4-fix-directive.md §3\n")
        fh.write("target: custom product page, en-US, APP_IPHONE_69 (1320x2868)\n\n")
        fh.write("\n".join(manifest) + "\n")

    print(f"\n{len(manifest)} frames ready in {out}")
    print("Next: create the custom product page, upload in slot order, submit for review.")
    return 0


def fail(msg: str) -> int:
    print(f"FAIL  {msg}")
    return 1


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    source = sys.argv[1]
    dest = sys.argv[2] if len(sys.argv) == 3 else os.path.join(source, "_upload")
    sys.exit(main(source, dest))
