import Accelerate
import CoreImage
import Foundation
import Vision

/**
 The measurements Workstream 7 needs and JavaScript cannot make.

 Everything here is Apple Vision or vDSP on pixels that never leave the device.
 There is no model download, no vendor and no network — the plan's rule is
 "extend the existing local Expo module rather than adding another vendor", and
 this file is inside the module that already ships.

 ── What each measurement is for, and what it is NOT ────────────────────────

 OCR reads a visible LABEL. It exists so a brand claim can have evidence
 (`tag-validate.ts` refuses a brand without it). It is not a general text
 scraper and its output is never stored — it is passed to the validator, used,
 and dropped.

 FEATURE PRINTS rank catalogue thumbnails against the photograph. They are
 opaque float vectors tied to a Vision revision, compared only to other vectors
 from the same revision on the same device.

 THE DUPLICATE FINGERPRINT is a 64-bit difference hash, and it is deliberately
 the weakest thing here. It answers one question — "have I already imported this
 exact photograph" — for one user, on one device. It cannot reconstruct an
 image, it is never transmitted, and there is no global index: the plan's line
 is "never a global cross-user photo index", and the way to keep that true is
 that nothing in this file has anywhere to send it.

 QUALITY is three deterministic numbers: sharpness (variance of the Laplacian),
 exposure (mean luminance plus clipping), and framing (subject coverage, which
 the existing lift already measures). Numbers, not verdicts — the thresholds
 live in JavaScript where they can be changed without a build.
 */
enum GarmentVision {
  // MARK: - OCR

  /**
   Text from a visible label, or an empty array.

   `.accurate` rather than `.fast`: a garment label is small, printed in a
   condensed face, and often at an angle — the fast path returns confident
   nonsense on exactly that input, and a wrong brand is the failure this whole
   route exists to avoid.

   `usesLanguageCorrection` is OFF. Correction is trained on prose and turns
   "COS" into "cost" and "ARKET" into "market"; a wordmark is not a word.
   */
  static func recognizeText(in image: CGImage) throws -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])

    return (request.results ?? []).compactMap { observation in
      observation.topCandidates(1).first?.string
    }
  }

  // MARK: - Feature print

  /**
   Vision's own image descriptor, and the revision that produced it.

   The revision travels with the vector because two prints from different
   Vision models live in different spaces. A distance computed between them
   would be a number, and it would be meaningless — the JS side refuses the
   comparison, and this is the field that lets it.
   */
  static func featurePrint(of image: CGImage) throws -> (values: [Float], revision: Int)? {
    let request = VNGenerateImageFeaturePrintRequest()
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])

    guard let observation = request.results?.first as? VNFeaturePrintObservation else {
      return nil
    }

    let count = observation.elementCount
    var values = [Float](repeating: 0, count: count)
    observation.data.withUnsafeBytes { raw in
      guard let base = raw.bindMemory(to: Float.self).baseAddress else { return }
      values = Array(UnsafeBufferPointer(start: base, count: count))
    }

    return (values, Int(VNGenerateImageFeaturePrintRequest.currentRevision))
  }

  // MARK: - Quality

  struct Quality {
    let sharpness: Double
    let meanLuminance: Double
    let clippedHighlights: Double
    let clippedShadows: Double
  }

  /**
   Three deterministic measurements over the luminance plane.

   SHARPNESS is the variance of the Laplacian — the standard, boring measure,
   chosen because it is the one whose failure modes are known. It is scale
   dependent, so the image is normalised to a fixed short edge first; without
   that, a bigger photograph of the same garment reads as sharper.

   EXPOSURE is mean luminance plus the share of pixels pinned at either end.
   Mean alone cannot tell a correctly exposed grey shirt from a photograph that
   is half blown-out white and half black.
   */
  static func quality(of image: CGImage) -> Quality? {
    guard let gray = grayscale(image, targetEdge: 256) else { return nil }

    let width = gray.width
    let height = gray.height
    var pixels = gray.pixels

    // Mean and clipping, in one pass.
    var sum: Double = 0
    var high = 0
    var low = 0
    for value in pixels {
      sum += Double(value)
      if value >= 250 { high += 1 }
      if value <= 5 { low += 1 }
    }
    let count = Double(pixels.count)
    let mean = count > 0 ? sum / count / 255.0 : 0

    // Laplacian, 4-neighbour, interior only.
    var laplacian = [Double]()
    laplacian.reserveCapacity(max(0, (width - 2) * (height - 2)))
    for y in 1..<max(1, height - 1) {
      for x in 1..<max(1, width - 1) {
        let i = y * width + x
        let value =
          4.0 * Double(pixels[i])
          - Double(pixels[i - 1])
          - Double(pixels[i + 1])
          - Double(pixels[i - width])
          - Double(pixels[i + width])
        laplacian.append(value)
      }
    }

    var variance: Double = 0
    if !laplacian.isEmpty {
      let lMean = laplacian.reduce(0, +) / Double(laplacian.count)
      variance = laplacian.reduce(0) { $0 + ($1 - lMean) * ($1 - lMean) } / Double(laplacian.count)
    }

    pixels.removeAll()

    return Quality(
      sharpness: variance,
      meanLuminance: mean,
      clippedHighlights: count > 0 ? Double(high) / count : 0,
      clippedShadows: count > 0 ? Double(low) / count : 0
    )
  }

  // MARK: - Duplicate fingerprint

  /**
   A 64-bit difference hash, as sixteen hex characters.

   The image is reduced to 9×8 greys and each pixel compared with its right
   neighbour: 64 comparisons, 64 bits. That is the whole algorithm, and its
   weakness is the point — it survives a re-encode and a crop of a few percent,
   which is what "the same photograph imported twice" looks like, and it tells
   you nothing about the picture. You cannot reconstruct a garment from
   sixty-four inequalities.

   Compared only against this user's own previous imports, on this device.
   */
  static func differenceHash(of image: CGImage) -> String? {
    guard let gray = grayscaleExact(image, width: 9, height: 8) else { return nil }

    var bits: UInt64 = 0
    var index = 0
    for y in 0..<8 {
      for x in 0..<8 {
        let left = gray.pixels[y * 9 + x]
        let right = gray.pixels[y * 9 + x + 1]
        if left > right { bits |= (1 << UInt64(index)) }
        index += 1
      }
    }
    return String(format: "%016llx", bits)
  }

  // MARK: - Pixel helpers

  private struct Gray {
    let pixels: [UInt8]
    let width: Int
    let height: Int
  }

  /** Downscale preserving aspect, then take luminance. */
  private static func grayscale(_ image: CGImage, targetEdge: Int) -> Gray? {
    let shortEdge = min(image.width, image.height)
    guard shortEdge > 0 else { return nil }
    let scale = Double(targetEdge) / Double(shortEdge)
    let width = max(1, Int((Double(image.width) * scale).rounded()))
    let height = max(1, Int((Double(image.height) * scale).rounded()))
    return grayscaleExact(image, width: width, height: height)
  }

  private static func grayscaleExact(_ image: CGImage, width: Int, height: Int) -> Gray? {
    var pixels = [UInt8](repeating: 0, count: width * height)
    guard
      let context = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width,
        space: CGColorSpaceCreateDeviceGray(),
        bitmapInfo: CGImageAlphaInfo.none.rawValue
      )
    else { return nil }

    context.interpolationQuality = .medium
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return Gray(pixels: pixels, width: width, height: height)
  }
}
