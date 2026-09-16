#!/usr/bin/env python3
"""
Pre-flight gate for an App Store screenshot delivery.

    python3 scripts/check-appstore-screenshots.py <folder>

Checks the mechanical spec (size, mode, count, naming) and then writes two
things a human has to actually look at:

  <folder>/_contact-sheet.png   every frame at 25%, side by side. This is the
                                v3 directive's own readability gate: if a
                                headline is not instantly readable here, the
                                frame fails.
  <folder>/_inspect/*.png       each frame's lower two-thirds at FULL size —
                                the phone-screen region.

Why _inspect exists: the v4 delivery (2026-09-16) shipped three frames with
text sliced in half by its own container. Every one of them was invisible in
the full-frame view and obvious at 100%. Mechanical checks cannot catch that
class of bug; eyes on the screen region can.

Exit code is 1 if any hard check fails. Alpha is a warning, not a failure —
Apple has accepted RGBA from this app since v3, and the upload path flattens.
"""

import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("pillow is required:  pip install pillow --break-system-packages")

EXPECTED_SIZE = (1320, 2868)  # iPhone 6.9" portrait (APP_IPHONE_69)
NAME_RE = re.compile(r"^\d{2}-[a-z0-9-]+\.png$")

# The phone mockup sits in the lower two-thirds of every frame that has one.
# Generous box, deliberately not tuned per frame.
INSPECT_BOX = (100, 840, 1220, EXPECTED_SIZE[1])


def main(folder: str) -> int:
    if not os.path.isdir(folder):
        return fail(f"not a folder: {folder}")

    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(".png") and not f.startswith("_"))
    if not files:
        return fail(f"no PNGs in {folder}")

    problems, warnings, images = [], [], []

    for name in files:
        path = os.path.join(folder, name)
        try:
            im = Image.open(path)
        except Exception as exc:  # noqa: BLE001
            problems.append(f"{name}: cannot open ({exc})")
            continue

        if im.size != EXPECTED_SIZE:
            problems.append(f"{name}: {im.size[0]}x{im.size[1]}, expected {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]}")
        if not NAME_RE.match(name):
            problems.append(f"{name}: name must be NN-slug.png, lowercase")
        if "A" in im.mode:
            alpha = im.convert("RGBA").getchannel("A").getextrema()
            note = "fully opaque, flattening is lossless" if alpha == (255, 255) else f"NON-OPAQUE {alpha}"
            warnings.append(f"{name}: {im.mode} carries an alpha channel ({note})")
        images.append((name, im))

        mb = os.path.getsize(path) / 1024 / 1024
        print(f"  {name:18s} {im.size[0]}x{im.size[1]}  {im.mode:5s} {mb:5.1f} MB")

    print()
    print(f"{len(files)} frames. Apple shows the first 3 on the install sheet.")
    if len(files) > 10:
        problems.append(f"{len(files)} frames; Apple's maximum is 10 per display size")

    # Contact sheet — the 25% readability gate.
    if images:
        scale = 0.25
        w, h = int(EXPECTED_SIZE[0] * scale), int(EXPECTED_SIZE[1] * scale)
        sheet = Image.new("RGB", (w * len(images), h), "white")
        for i, (_, im) in enumerate(images):
            sheet.paste(im.convert("RGB").resize((w, h), Image.LANCZOS), (i * w, 0))
        sheet_path = os.path.join(folder, "_contact-sheet.png")
        sheet.save(sheet_path)
        print(f"wrote {sheet_path}  — headlines must be readable here")

        inspect_dir = os.path.join(folder, "_inspect")
        os.makedirs(inspect_dir, exist_ok=True)
        for name, im in images:
            crop = im.convert("RGB").crop(INSPECT_BOX)
            crop.save(os.path.join(inspect_dir, name.replace(".png", "-screen.png")))
        print(f"wrote {inspect_dir}/  — LOOK AT THESE before delivering")

    print()
    for w_ in warnings:
        print(f"warn  {w_}")
    for p in problems:
        print(f"FAIL  {p}")

    if problems:
        print(f"\n{len(problems)} problem(s).")
        return 1
    print("\nMechanical spec OK. The readability and clipping gates are yours to run by eye.")
    return 0


def fail(msg: str) -> int:
    print(f"FAIL  {msg}")
    return 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
