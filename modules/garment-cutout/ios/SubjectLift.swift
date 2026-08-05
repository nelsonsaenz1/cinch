import CoreGraphics
import Vision

/**
 Apple Vision subject lifting.

 `VNGenerateForegroundInstanceMaskRequest` (iOS 17+) is the same model behind
 "Copy Subject" in Photos. It returns one `VNInstanceMaskObservation` whose
 `allInstances` is an `IndexSet` of the *salient* foreground instances — which is
 not the same thing as "the garment". On a real wardrobe photo it will happily
 return the hanger, a hand, or the mannequin alongside the shirt, so every
 instance is lifted and handed up rather than assuming the first one is right.

 Instances come back ordered by mask area, largest first. Vision's own index
 order carries no meaning, and on flat-lays and hanger shots the garment is
 essentially always the biggest thing lifted — so area is a materially better
 default than index 0, and the caller still gets the rest for a "wrong one" retry.
 */
@available(iOS 17.0, *)
internal enum SubjectLift {
  /// One lifted instance, already persisted by the caller's `emit`.
  struct Subject {
    let url: URL
    let width: Int
    let height: Int
    /// Opaque pixels as a fraction of the whole source frame, 0..1.
    let areaFraction: Double
  }

  struct Result {
    let subjects: [Subject]
    /// Pixels of the largest subject — the one the plate and palette are built from.
    let primaryBitmap: Bitmap?
    let primaryExtent: AlphaExtent?
  }

  /**
   Lift every foreground instance out of `source`, persisting each through `emit`.

   Persisting inside the loop rather than returning a pile of `CGImage`s is
   deliberate: each masked instance is a frame-sized RGBA allocation, the upload
   queue runs three of these jobs concurrently, and holding them all until the
   end is precisely the allocation pattern that gets a 60-photo import killed by
   jetsam. Only the current winner's pixels survive an iteration, because the
   plate render and the palette both need them and re-lifting to get them back
   would cost a second Vision pass.

   Returns an empty subject list when Vision finds nothing — an ordinary outcome
   for a flat-lay on a patterned rug or white-on-white, not an error.
   */
  static func lift(
    from source: CGImage,
    emit: (CGImage, Double) throws -> URL
  ) throws -> Result {
    let handler = VNImageRequestHandler(cgImage: source, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])

    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      return Result(subjects: [], primaryBitmap: nil, primaryExtent: nil)
    }

    let sourceArea = Double(source.width * source.height)
    var subjects: [Subject] = []
    var primaryBitmap: Bitmap?
    var primaryExtent: AlphaExtent?
    var primaryArea = -1.0

    for index in observation.allInstances {
      // Each instance gets its own pool so Vision's buffer and our rasterized
      // copy are both gone before the next one is requested.
      try autoreleasepool {
        let buffer = try observation.generateMaskedImage(
          ofInstances: IndexSet(integer: index),
          from: handler,
          croppedToInstancesExtent: true
        )
        guard let masked = GarmentImaging.copyImage(from: buffer),
              let bitmap = GarmentImaging.rasterize(masked),
              let extent = GarmentImaging.alphaExtent(of: bitmap) else {
          // A mask with no opaque pixels is not a subject. Skipping beats
          // emitting an empty cutout the closet would render as a blank tile.
          return
        }

        let areaFraction = sourceArea > 0 ? Double(extent.opaqueCount) / sourceArea : 0
        let url = try emit(masked, areaFraction)
        subjects.append(
          Subject(url: url, width: masked.width, height: masked.height, areaFraction: areaFraction)
        )

        if areaFraction > primaryArea {
          primaryArea = areaFraction
          primaryBitmap = bitmap
          primaryExtent = extent
        }
      }
    }

    return Result(
      subjects: subjects.sorted { $0.areaFraction > $1.areaFraction },
      primaryBitmap: primaryBitmap,
      primaryExtent: primaryExtent
    )
  }
}
