import ExpoModulesCore
import Foundation
import Vision

/**
 The JS-visible half of the measurements in `GarmentVision.swift`.

 A SECOND module in the same local module rather than a second module
 directory: it shares the decode path, the podspec and the deployment target
 with the cutout, and every one of these measurements runs on pixels the cutout
 has already decoded once. Two directories would mean two pods and two decodes.

 ── The shape of every answer ──────────────────────────────────────────────

 NUMBERS, NOT VERDICTS. `quality` returns sharpness and luminance; it does not
 return "blurry". Thresholds live in `src/features/intake/photo-match.ts` where
 they can be recalibrated in an OTA rather than a store build — which matters,
 because a threshold is exactly the thing that turns out to be wrong first.

 NULL, NOT A GUESS. Every capability reports itself honestly: `isAvailable`
 tells JavaScript what this device can actually do, and a request on a device
 that cannot do it returns null rather than a plausible number. The Simulator
 has no Neural Engine, and half of this genuinely does not run there.
 */
public class GarmentVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GarmentVision")

    /**
     What this device can measure, field by field.

     Deliberately granular rather than one boolean. Text recognition and feature
     prints run on the CPU and work in the Simulator; the cutout's subject lift
     does not. A single `isAvailable` would have to answer for both and would be
     wrong about one of them.
     */
    Function("capabilities") { () -> [String: Any] in
      #if targetEnvironment(simulator)
        let simulator = true
      #else
        let simulator = false
      #endif
      return [
        "ocr": true,
        "featurePrint": true,
        "quality": true,
        "duplicateHash": true,
        // The lift needs the Neural Engine. Reported here so one call answers
        // "what can this device do" for the whole intake path.
        "subjectLift": !simulator,
        "featurePrintRevision": Int(VNGenerateImageFeaturePrintRequest.currentRevision),
        "simulator": simulator,
      ]
    }

    /**
     Every measurement for one photograph, in one pass.

     One call because each of these decodes the same file, and a 60-photo import
     that decodes four times per photo is an import that gets the app killed.
     The cutout module makes the same argument for the same reason.
     */
    AsyncFunction("measure") { (uri: String, options: MeasureOptions?) -> [String: Any?] in
      let options = options ?? MeasureOptions()
      let url = Self.fileURL(from: uri)

      guard let image = GarmentImaging.decodeUpright(url: url, maxEdge: options.maxEdge) else {
        throw ImageDecodeFailedException(uri)
      }

      var out: [String: Any?] = [
        "ocrText": nil,
        "featurePrint": nil,
        "quality": nil,
        "duplicateHash": nil,
      ]

      if options.ocr {
        // Joined with a space rather than returned as lines: the consumer is a
        // substring test for a brand, and line breaks in a label are an artefact
        // of where the printing wrapped.
        let lines = (try? GarmentVision.recognizeText(in: image)) ?? []
        out["ocrText"] = lines.isEmpty ? nil : lines.joined(separator: " ")
      }

      if options.featurePrint, let print = try? GarmentVision.featurePrint(of: image) {
        out["featurePrint"] = [
          "values": print.values.map { Double($0) },
          "revision": print.revision,
        ]
      }

      if options.quality, let quality = GarmentVision.quality(of: image) {
        out["quality"] = [
          "sharpness": quality.sharpness,
          "meanLuminance": quality.meanLuminance,
          "clippedHighlights": quality.clippedHighlights,
          "clippedShadows": quality.clippedShadows,
        ]
      }

      if options.duplicateHash {
        out["duplicateHash"] = GarmentVision.differenceHash(of: image)
      }

      return out
    }
  }

  /** `file://…` or a bare path, as every other call site in this module accepts. */
  private static func fileURL(from uri: String) -> URL {
    if let url = URL(string: uri), url.isFileURL { return url }
    return URL(fileURLWithPath: uri)
  }
}

/**
 What to measure.

 Each measurement is opt-in rather than always-on: the duplicate check runs on
 every import and needs only the hash, while the catalogue fast path needs the
 print and the OCR. Asking for all four when two are wanted is wasted battery on
 a path the user is waiting for.
 */
struct MeasureOptions: Record {
  @Field var ocr: Bool = true
  @Field var featurePrint: Bool = true
  @Field var quality: Bool = true
  @Field var duplicateHash: Bool = true
  /** Long edge the source is decoded at. Matches the cutout's default. */
  @Field var maxEdge: Int = 1024
}
