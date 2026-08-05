import CoreGraphics

/**
 Scale normalization — the step that makes a stacked outfit read as one picture.

 Raw cutouts carry the photographer's distance, not the garment's size. A coat
 shot from across the room and a ring shot from 20cm away come out of Vision at
 similar pixel dimensions, so a plate built from raw cutouts renders a ring the
 size of a trench coat. Normalizing at ingest fixes that once, for every surface
 that ever draws the item, instead of asking each renderer to guess.

 The geometry, all in fractions of the canvas edge so it is resolution-independent:

   canvas      square, 1024x1024, fully transparent
   long edge   the garment's longer bbox dimension is scaled to `targetFill`
               of the canvas edge (default 0.88; per-slot overrides come from
               the JS layer, which owns the category vocabulary)
   horizontal  centred on the bbox, not on the image — a sleeve hanging to one
               side must not push the body off-centre
   vertical    the bbox's BOTTOM edge lands at `baseline` (0.94) of the canvas
               height, so every garment stands on the same floor line

 A shared baseline rather than a shared centre is the part that matters visually:
 garments in a look are worn stacked, and a common bottom edge is what lets a
 jacket sit over trousers without either floating.
 */
internal enum PlateRenderer {
  static func render(
    bitmap: Bitmap,
    extent: AlphaExtent,
    canvasSize: Int,
    targetFill: Double,
    baseline: Double
  ) -> CGImage? {
    let size = max(64, canvasSize)
    let canvas = CGFloat(size)
    let fill = CGFloat(min(max(targetFill, 0.1), 1.0))
    let floorLine = CGFloat(min(max(baseline, 0.5), 1.0))

    let box = extent.bounds
    guard box.width > 0, box.height > 0,
          let source = GarmentImaging.makeImage(from: bitmap),
          let cropped = source.cropping(to: box) else {
      return nil
    }

    let longEdge = max(box.width, box.height)
    var scale = (fill * canvas) / longEdge
    // A very tall, narrow garment scaled by its long edge could otherwise reach
    // past the top of the canvas once it is anchored to the baseline. Clamping
    // here costs a little fill on trench coats and never clips one.
    scale = min(scale, (floorLine * canvas) / box.height)

    let drawWidth = box.width * scale
    let drawHeight = box.height * scale
    let originX = (canvas - drawWidth) / 2
    // CGBitmapContext is bottom-left origin, so a baseline measured from the top
    // becomes its complement from the bottom.
    let originY = canvas * (1 - floorLine)

    guard let context = CGContext(
      data: nil,
      width: size,
      height: size,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        | CGBitmapInfo.byteOrder32Big.rawValue
    ) else {
      return nil
    }

    // Freshly allocated bitmap contexts are zeroed, which for premultiplied RGBA
    // is transparent — no explicit clear needed, and clearing would only cost a
    // full-canvas pass.
    context.interpolationQuality = .high
    context.draw(
      cropped,
      in: CGRect(x: originX, y: originY, width: drawWidth, height: drawHeight)
    )
    return context.makeImage()
  }
}
