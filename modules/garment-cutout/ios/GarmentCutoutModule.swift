import ExpoModulesCore
import Foundation

/**
 One native pass per garment photo: subject lift, plate render, palette.

 Kept as a single call on purpose. Every stage needs the same decoded pixels, and
 splitting it into three JS-visible steps would mean decoding the photo three
 times and shuttling two intermediate PNGs across the bridge — during a 60-photo
 import that is the difference between a pipeline that finishes and one that gets
 the app killed.

 The JS side (`src/lib/bg-removal.ts`) owns the vocabulary decisions: which slot
 fill fraction to pass, what to do with more than one subject, and how an outcome
 maps to UI. This side owns nothing but pixels.
 */
public class GarmentCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GarmentCutout")

    /**
     Whether a lift can succeed on this device at all.

     Two separate gates. iOS 17 is the API floor. The Simulator is excluded
     because subject lifting runs on the Neural Engine, which the Simulator does
     not have — attempting it there produces a Vision error that reads like a
     bug, whereas reporting "unsupported" drives the no-cutout state the UI was
     designed around.
     */
    Function("isAvailable") { () -> Bool in
      #if targetEnvironment(simulator)
        return false
      #else
        if #available(iOS 17.0, *) {
          return true
        }
        return false
      #endif
    }

    AsyncFunction("analyze") { (uri: String, options: AnalyzeOptions?) -> [String: Any?] in
      let options = options ?? AnalyzeOptions()

      guard #available(iOS 17.0, *) else {
        return Self.empty(outcome: "unsupported")
      }
      #if targetEnvironment(simulator)
        return Self.empty(outcome: "unsupported")
      #else
        return try self.analyze(uri: uri, options: options)
      #endif
    }
  }

  // MARK: - Pipeline

  @available(iOS 17.0, *)
  private func analyze(uri: String, options: AnalyzeOptions) throws -> [String: Any?] {
    guard let cacheDirectory = appContext?.config.cacheDirectory else {
      throw CacheDirectoryUnavailableException()
    }
    let outputDirectory = URL(fileURLWithPath: cacheDirectory.path)
      .appendingPathComponent("GarmentCutout")
    FileSystemUtilities.ensureDirExists(at: outputDirectory)

    let sourceURL = Self.fileURL(from: uri)
    guard let source = GarmentImaging.decodeUpright(url: sourceURL, maxEdge: options.maxEdge) else {
      throw ImageDecodeFailedException(uri)
    }

    let stem = UUID().uuidString
    var emitted = 0
    let lift = try SubjectLift.lift(from: source) { image, _ in
      emitted += 1
      return try GarmentImaging.writePNG(image, to: outputDirectory, named: "\(stem)-\(emitted).png")
    }

    guard !lift.subjects.isEmpty,
          let bitmap = lift.primaryBitmap,
          let extent = lift.primaryExtent else {
      return Self.empty(outcome: "no-subject")
    }

    // The plate and the palette are both built from the LARGEST subject. If the
    // user later corrects the choice, re-normalizing from the stored cutout is
    // cheap; re-lifting from the original is not.
    var plate: [String: Any]?
    if let render = PlateRenderer.render(
      bitmap: bitmap,
      extent: extent,
      canvasSize: options.canvasSize,
      targetFill: options.targetFill,
      baseline: options.baseline
    ), let url = try? GarmentImaging.writePNG(render, to: outputDirectory, named: "\(stem)-plate.png") {
      plate = ["uri": url.absoluteString, "width": render.width, "height": render.height]
    }

    let colors = Palette.extract(from: bitmap, clusters: options.colorCount)

    return [
      "outcome": "ok",
      "subjects": lift.subjects.map { subject in
        [
          "uri": subject.url.absoluteString,
          "width": subject.width,
          "height": subject.height,
          "areaFraction": subject.areaFraction,
        ] as [String: Any]
      },
      // A missing plate is survivable — the closet falls back to the cutout —
      // so a failed render does not fail the whole analysis.
      "plate": plate,
      "colors": colors.map { ["hex": $0.hex, "share": $0.share] as [String: Any] },
    ]
  }

  private static func empty(outcome: String) -> [String: Any?] {
    ["outcome": outcome, "subjects": [], "plate": nil, "colors": []]
  }

  /// Accepts both `file://` URIs and bare paths; the picker has produced each.
  private static func fileURL(from uri: String) -> URL {
    if let url = URL(string: uri), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: uri)
  }
}

/**
 Per-call knobs.

 Defaults match the ingest path. The JS layer overrides `targetFill` per garment
 slot and raises `maxEdge` on the one retry it is allowed — Vision's saliency is
 genuinely scale-sensitive, and a garment it misses at 1024px is sometimes found
 at 1536px.
 */
internal struct AnalyzeOptions: Record {
  init() {}

  /// Long edge the source is decoded at before Vision sees it.
  @Field var maxEdge: Int = 1024

  /// Edge of the square plate canvas, in pixels.
  @Field var canvasSize: Int = 1024

  /// Fraction of the canvas edge the garment's long edge fills.
  @Field var targetFill: Double = 0.88

  /// Where the garment's bottom edge lands, as a fraction of canvas height from the top.
  @Field var baseline: Double = 0.94

  /// How many clusters the measured palette is reduced to.
  @Field var colorCount: Int = 3
}
