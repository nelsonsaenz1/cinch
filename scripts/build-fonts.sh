#!/usr/bin/env bash
#
# Regenerate the Bodoni Moda display cut in assets/fonts/.
#
# WHY THIS EXISTS
#
# Bodoni Moda is a variable font with an `opsz` (optical size) axis from 6 to 96.
# A didone is drawn differently at every size: at caption sizes the hairlines are
# thickened so they survive, and at display sizes they thin out dramatically —
# that contrast is the whole point of the letterform.
#
# React Native cannot set variable font axes on iOS. A variable TTF renders only
# its default instance, and every static cut in @expo-google-fonts/bodoni-moda is
# instanced at the axis default, which is opsz=11 — the caption master. Setting
# that at 62px gives you a fat, low-contrast didone that looks subtly cheap and is
# very hard to diagnose, because nothing is broken; it is just the wrong drawing.
#
# CHOOSING THE OPTICAL SIZE
#
# The print rule is opsz ≈ point size. On a phone that is wrong, because the
# hairline has to survive rasterisation. Measured hairline on the 'O', at 62px:
#
#     opsz=11   0.01800 em   3.35 device px @3x   ← the stock cut. No contrast.
#     opsz=24   0.00850 em   1.58 device px @3x   ← chosen. Crisp at @2x and @3x.
#     opsz=40   0.00400 em   0.74 device px @3x
#     opsz=96   0.00200 em   0.37 device px @3x   ← true display master, drops out.
#
# opsz=24 is the coarsest cut that still reads as a display didone, and it stays
# above one device pixel on @2x hardware (iPhone SE), where opsz=40 and finer
# render as grey mush instead of a hairline.
#
# Bodoni Moda is OFL 1.1 with no Reserved Font Name, so instancing and bundling is
# permitted. assets/fonts/OFL.txt ships alongside and must stay there.
#
# Usage:  ./scripts/build-fonts.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/assets/fonts"
SRC="https://github.com/google/fonts/raw/main/ofl/bodonimoda/BodoniModa%5Bopsz,wght%5D.ttf"
LICENSE="https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/OFL.txt"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v python3 >/dev/null || { echo "python3 required"; exit 1; }
python3 -c "import fontTools" 2>/dev/null || { echo "pip install fonttools"; exit 1; }

mkdir -p "$OUT"
echo "==> Downloading the variable font"
curl -sL -o "$TMP/BodoniModa.ttf" "$SRC"
curl -sL -o "$OUT/OFL.txt" "$LICENSE"

echo "==> Instancing wght=600 opsz=24"
python3 -m fontTools.varLib.instancer "$TMP/BodoniModa.ttf" \
  wght=600 opsz=24 -o "$OUT/BodoniModa_Display.ttf"

echo "==> Done:"
ls -la "$OUT"
