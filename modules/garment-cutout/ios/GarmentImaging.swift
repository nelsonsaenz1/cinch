import CoreGraphics
import CoreImage
import ImageIO
import UIKit

/**
 Pixel plumbing shared by the lift, the plate renderer and the palette sampler.

 Everything downstream reads one canonical layout — 8-bit RGBA, premultiplied,
 row-major, no padding — so that alpha thresholds and colour maths never have to
 ask what the source format was. Vision hands back BGRA, ImageIO hands back
 whatever the file happened to be, and a subtly wrong channel order shows up as
 "the app thinks every navy coat is orange" rather than as a crash.
 */
internal struct Bitmap {
  let width: Int
  let height: Int
  /// RGBA8, premultiplied by alpha, `width * height * 4` bytes.
  let pixels: [UInt8]
}

/// The opaque extent of a cutout, in top-left-origin pixel coordinates.
internal struct AlphaExtent {
  let bounds: CGRect
  /// Pixels at or above the opacity threshold. Used for the area ranking.
  let opaqueCount: Int
}

internal enum GarmentImaging {
  /// Anything below this is matte fringing or shadow, not garment.
  static let opaqueThreshold: UInt8 = 128

  /**
   Decode a file at a bounded resolution, already rotated upright.

   ImageIO's thumbnail path decodes *at* the target size rather than decoding
   full-resolution and then scaling, which is the difference between ~4 MB and
   ~50 MB of live pixels per job. That matters here specifically: the upload
   queue runs three jobs concurrently, and Vision then allocates a masked buffer
   per instance on top — the naive version is how a 60-photo import gets the app
   killed by jetsam halfway through.

   `kCGImageSourceCreateThumbnailWithTransform` applies the EXIF orientation, so
   a portrait photo does not come back on its side. `maxPixelSize` never
   upscales, so a small source is used as-is.
   */
  static func decodeUpright(url: URL, maxEdge: Int) -> CGImage? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
      return nil
    }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: max(64, maxEdge),
    ]
    return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  }

  /**
   Copy a Vision-owned pixel buffer into a CGImage we own.

   The buffer is locked for exactly the length of the copy and unlocked in a
   `defer`, so an early return or a throw downstream can never strand a locked
   full-resolution buffer. `makeImage()` snapshots the bytes, which is what makes
   it safe to keep the result after the unlock.
   */
  static func copyImage(from buffer: CVPixelBuffer) -> CGImage? {
    if CVPixelBufferGetPixelFormatType(buffer) == kCVPixelFormatType_32BGRA {
      CVPixelBufferLockBaseAddress(buffer, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }

      if let base = CVPixelBufferGetBaseAddress(buffer),
         let context = CGContext(
          data: base,
          width: CVPixelBufferGetWidth(buffer),
          height: CVPixelBufferGetHeight(buffer),
          bitsPerComponent: 8,
          bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
          space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
            | CGBitmapInfo.byteOrder32Little.rawValue
         ) {
        return context.makeImage()
      }
    }

    // Format we did not plan for. Correctness beats the fast path; Core Image
    // will convert whatever it is.
    let ciImage = CIImage(cvPixelBuffer: buffer)
    return sharedCIContext.createCGImage(ciImage, from: ciImage.extent)
  }

  private static let sharedCIContext = CIContext(options: [.useSoftwareRenderer: false])

  /// Redraw any CGImage into the canonical RGBA8 layout.
  static func rasterize(_ image: CGImage) -> Bitmap? {
    let width = image.width
    let height = image.height
    guard width > 0, height > 0 else { return nil }

    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let ok = pixels.withUnsafeMutableBytes { raw -> Bool in
      guard let base = raw.baseAddress,
            let context = CGContext(
              data: base,
              width: width,
              height: height,
              bitsPerComponent: 8,
              bytesPerRow: width * 4,
              space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                | CGBitmapInfo.byteOrder32Big.rawValue
            ) else {
        return false
      }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    return ok ? Bitmap(width: width, height: height, pixels: pixels) : nil
  }

  /**
   The tight box around the garment, plus how much of the frame it covers.

   `croppedToInstancesExtent` already trims to the mask's bounding box, so this
   usually agrees with the full frame — but it is computed rather than assumed,
   because the plate's whole job is to place a garment at a known scale and a
   few rows of stray alpha would quietly shrink every render.
   */
  static func alphaExtent(of bitmap: Bitmap) -> AlphaExtent? {
    var minX = bitmap.width
    var minY = bitmap.height
    var maxX = -1
    var maxY = -1
    var opaque = 0

    bitmap.pixels.withUnsafeBufferPointer { buffer in
      for y in 0..<bitmap.height {
        let row = y * bitmap.width * 4
        for x in 0..<bitmap.width where buffer[row + x * 4 + 3] >= opaqueThreshold {
          opaque += 1
          if x < minX { minX = x }
          if x > maxX { maxX = x }
          if y < minY { minY = y }
          if y > maxY { maxY = y }
        }
      }
    }

    guard maxX >= minX, maxY >= minY else { return nil }
    return AlphaExtent(
      bounds: CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1),
      opaqueCount: opaque
    )
  }

  /// Rebuild a drawable image from canonical pixels.
  static func makeImage(from bitmap: Bitmap) -> CGImage? {
    guard let provider = CGDataProvider(data: Data(bitmap.pixels) as CFData) else { return nil }
    return CGImage(
      width: bitmap.width,
      height: bitmap.height,
      bitsPerComponent: 8,
      bitsPerPixel: 32,
      bytesPerRow: bitmap.width * 4,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGBitmapInfo(
        rawValue: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
      ),
      provider: provider,
      decode: nil,
      shouldInterpolate: true,
      intent: .defaultIntent
    )
  }

  /// Write a PNG into the module's cache directory and return its file URL.
  static func writePNG(_ image: CGImage, to directory: URL, named name: String) throws -> URL {
    let url = directory.appendingPathComponent(name)
    guard let data = UIImage(cgImage: image).pngData() else {
      throw PNGEncodingFailedException(name)
    }
    try data.write(to: url, options: .atomic)
    return url
  }
}
