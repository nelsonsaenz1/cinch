import Foundation

/**
 Measured garment colour.

 The tagging model returns colour *names* and is unreliable at exact values; this
 reads the actual pixels. Two choices carry the quality here:

 1. ONLY FULLY OPAQUE PIXELS COUNT. Vision's mask feathers its edge, and a
    feathered pixel is a blend of the garment and whatever was behind it. Include
    the fringe and a black shirt photographed on a white duvet reports mid-grey.
    The threshold is alpha > 0.9.

 2. CLUSTERING HAPPENS IN OKLab, NOT RGB. Median cut in RGB splits along
    channels that do not correspond to anything a person sees, so a navy jacket
    with a lighter navy panel comes back as two "different" colours while a red
    and an orange merge. OKLab is perceptually uniform, so an equal split is an
    equally visible split.

 The OKLab transform below is Björn Ottosson's reference implementation
 ("A perceptual color space for image processing", 2020) — the same constants as
 `src/lib/color/oklch.ts`, deliberately duplicated rather than approximated so
 that a hex measured here and a hex parsed there land in the same place. The
 digits are load-bearing; round-trip error grows fast if they are shortened.
 */
internal struct Swatch {
  let hex: String
  /// Share of sampled garment pixels this cluster covers, 0..1.
  let share: Double
}

internal enum Palette {
  /// Alpha at or above this is garment; below it is matte fringing.
  private static let opaqueFloor: UInt8 = 230
  /// Enough samples for a stable median, few enough to stay off the frame budget.
  private static let targetSamples = 24_000

  private struct Lab {
    var l: Double
    var a: Double
    var b: Double
  }

  /**
   Reduce a cutout to its dominant colours, largest share first.

   Deterministic by construction: a fixed stride rather than random sampling, and
   median cut rather than k-means, so the same photo always yields the same
   swatches. That matters because these values are written to the row once and
   never recomputed — a wobbling palette would mean two identical shirts scoring
   differently in the styling engine.
   */
  static func extract(from bitmap: Bitmap, clusters: Int) -> [Swatch] {
    var samples: [Lab] = []
    samples.reserveCapacity(targetSamples)

    let total = bitmap.width * bitmap.height
    let step = max(1, Int((Double(total) / Double(targetSamples)).squareRoot().rounded(.up)))

    bitmap.pixels.withUnsafeBufferPointer { pixels in
      for y in stride(from: 0, to: bitmap.height, by: step) {
        let row = y * bitmap.width * 4
        for x in stride(from: 0, to: bitmap.width, by: step) {
          let i = row + x * 4
          let alpha = pixels[i + 3]
          guard alpha >= opaqueFloor else { continue }
          // Canonical pixels are premultiplied; recover the garment's own colour
          // before converting, or every swatch drifts toward black.
          let scale = 255.0 / Double(alpha)
          samples.append(
            toOklab(
              r: min(1, Double(pixels[i]) * scale / 255),
              g: min(1, Double(pixels[i + 1]) * scale / 255),
              b: min(1, Double(pixels[i + 2]) * scale / 255)
            )
          )
        }
      }
    }

    guard !samples.isEmpty else { return [] }

    // Median cut: repeatedly split the box that is both large and populous along
    // its longest perceptual axis, at the median rather than the midpoint, so a
    // small bright trim cannot claim a cluster of its own.
    var boxes: [Range<Int>] = [0..<samples.count]
    while boxes.count < max(1, clusters) {
      let splittable = boxes.indices.filter { boxes[$0].count > 1 }
      guard let pick = splittable.max(by: { spread(samples, boxes[$0]).1 * Double(boxes[$0].count)
                                            < spread(samples, boxes[$1]).1 * Double(boxes[$1].count) })
      else { break }

      let range = boxes[pick]
      let axis = spread(samples, range).0
      var slice = Array(samples[range])
      slice.sort { value($0, axis) < value($1, axis) }
      samples.replaceSubrange(range, with: slice)

      let mid = range.lowerBound + range.count / 2
      boxes.remove(at: pick)
      boxes.append(range.lowerBound..<mid)
      boxes.append(mid..<range.upperBound)
    }

    let sampled = Double(samples.count)
    return boxes
      .filter { !$0.isEmpty }
      .map { range -> Swatch in
        var sum = Lab(l: 0, a: 0, b: 0)
        for i in range {
          sum.l += samples[i].l
          sum.a += samples[i].a
          sum.b += samples[i].b
        }
        let n = Double(range.count)
        let mean = Lab(l: sum.l / n, a: sum.a / n, b: sum.b / n)
        return Swatch(hex: toHex(mean), share: n / sampled)
      }
      .sorted { $0.share > $1.share }
  }

  // MARK: - Colour maths (Ottosson 2020)

  private static func value(_ lab: Lab, _ axis: Int) -> Double {
    axis == 0 ? lab.l : (axis == 1 ? lab.a : lab.b)
  }

  /// The widest axis of a box and how wide it is.
  private static func spread(_ samples: [Lab], _ range: Range<Int>) -> (Int, Double) {
    var lo = [Double.infinity, .infinity, .infinity]
    var hi = [-Double.infinity, -.infinity, -.infinity]
    for i in range {
      for axis in 0..<3 {
        let v = value(samples[i], axis)
        if v < lo[axis] { lo[axis] = v }
        if v > hi[axis] { hi[axis] = v }
      }
    }
    var best = 0
    for axis in 1..<3 where hi[axis] - lo[axis] > hi[best] - lo[best] { best = axis }
    return (best, hi[best] - lo[best])
  }

  private static func srgbToLinear(_ c: Double) -> Double {
    c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
  }

  private static func linearToSrgb(_ c: Double) -> Double {
    c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1 / 2.4) - 0.055
  }

  private static func toOklab(r: Double, g: Double, b: Double) -> Lab {
    let lr = srgbToLinear(r)
    let lg = srgbToLinear(g)
    let lb = srgbToLinear(b)

    let l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
    let m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
    let s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

    let l_ = cbrt(l)
    let m_ = cbrt(m)
    let s_ = cbrt(s)

    return Lab(
      l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    )
  }

  private static func toHex(_ lab: Lab) -> String {
    let l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b
    let m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b
    let s_ = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b

    let l = l_ * l_ * l_
    let m = m_ * m_ * m_
    let s = s_ * s_ * s_

    let r = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
    let g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
    let b = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)

    let byte = { (c: Double) -> Int in Int((min(max(c, 0), 1) * 255).rounded()) }
    return String(format: "#%02x%02x%02x", byte(r), byte(g), byte(b))
  }
}
