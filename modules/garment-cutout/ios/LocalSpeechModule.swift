import ExpoModulesCore
import Foundation
import Speech

/**
 On-device transcription for ONE SHORT PHRASE — the catalogue query, and
 nothing else.

 ── What this is for, and what it is deliberately not for ──────────────────

 "James Perse men's T-shirt" is four words spoken into a search field. Sending
 that to a cloud ASR costs a round trip, a consent, a slice of quota and an
 upload of the user's voice — for a sentence Apple's own recogniser handles on
 the phone, offline, in under a second.

 THE BULK WALKTHROUGH STAYS ON ITS CLOUD PATH, untouched. Twelve minutes of
 someone reading a wardrobe aloud is a different problem: on-device recognition
 degrades badly over long audio, the walkthrough's whole value is accuracy over
 garment nouns, and `transcribe-intake` already does it well with a vocabulary
 prompt. Moving it here would be a downgrade dressed as a privacy win.

 ── Honesty about capability is the whole interface ────────────────────────

 `requiresOnDeviceRecognition` makes the recogniser refuse rather than silently
 fall back to Apple's servers, which is the only way "on-device" can be a claim
 rather than a hope. Every reason it might not work — no permission, no locale,
 no on-device model, a Simulator — is reported as a distinct state so the JS
 side can offer the existing consent-gated cloud path EXPLICITLY instead of
 appearing broken.

 SPEECH RECOGNITION DOES NOT RUN IN THE SIMULATOR. That is Apple's constraint,
 not a bug in this file, and `support()` says so rather than pretending.
 */
public class LocalSpeechModule: Module {
  private var recognizer: SFSpeechRecognizer?

  public func definition() -> ModuleDefinition {
    Name("LocalSpeech")

    /**
     Everything the caller needs to decide between local and cloud, in one call.

     Four independent facts, because they fail independently: the OS may not
     have a recogniser for this locale, the device may not hold an on-device
     model for it, the user may not have granted permission, and the Simulator
     has no speech stack at all.
     */
    Function("support") { (localeTag: String?) -> [String: Any?] in
      #if targetEnvironment(simulator)
        let simulator = true
      #else
        let simulator = false
      #endif

      let locale = localeTag.map(Locale.init(identifier:)) ?? Locale.current
      let recognizer = SFSpeechRecognizer(locale: locale)

      return [
        "simulator": simulator,
        "locale": recognizer?.locale.identifier ?? locale.identifier,
        // A recogniser exists for this locale at all.
        "localeSupported": recognizer != nil,
        // The service is reachable/usable right now.
        "available": recognizer?.isAvailable ?? false,
        // The device holds an on-device model for it. This is the one that
        // decides whether a local transcript is possible, and it is false on
        // plenty of real hardware — hence the explicit cloud offer.
        "onDeviceSupported": recognizer?.supportsOnDeviceRecognition ?? false,
        "authorization": Self.authorizationLabel(SFSpeechRecognizer.authorizationStatus()),
      ]
    }

    /**
     Ask, once.

     Separate from `transcribe` on purpose: the permission sheet is a moment the
     UI has to be able to place — before the microphone opens, next to the
     sentence explaining why — rather than something that happens in the middle
     of a transcription.
     */
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      SFSpeechRecognizer.requestAuthorization { status in
        promise.resolve(Self.authorizationLabel(status))
      }
    }

    /**
     Transcribe a recorded file locally, or say precisely why not.

     A FILE, not a live buffer. The recording already exists — `useRecorder`
     wrote it — and re-opening the microphone here would mean two audio sessions
     for one utterance and a second place that can leave the mic on.

     `requiresOnDeviceRecognition = true` unconditionally. If the device cannot
     do it, this fails and the caller offers the cloud path with consent, which
     is a decision the user gets to make rather than one made silently on their
     behalf by a fallback.
     */
    AsyncFunction("transcribe") { (uri: String, localeTag: String?, promise: Promise) in
      let status = SFSpeechRecognizer.authorizationStatus()
      guard status == .authorized else {
        promise.resolve(Self.failure("not_authorized", Self.authorizationLabel(status)))
        return
      }

      let locale = localeTag.map(Locale.init(identifier:)) ?? Locale.current
      guard let recognizer = SFSpeechRecognizer(locale: locale) else {
        promise.resolve(Self.failure("locale_unsupported", locale.identifier))
        return
      }
      guard recognizer.isAvailable else {
        promise.resolve(Self.failure("unavailable", nil))
        return
      }
      guard recognizer.supportsOnDeviceRecognition else {
        promise.resolve(Self.failure("on_device_unsupported", locale.identifier))
        return
      }

      self.recognizer = recognizer

      let url = URL(string: uri).flatMap { $0.isFileURL ? $0 : nil } ?? URL(fileURLWithPath: uri)
      let request = SFSpeechURLRecognitionRequest(url: url)
      request.requiresOnDeviceRecognition = true
      request.shouldReportPartialResults = false
      // A catalogue query is a noun phrase, not dictation. `.search` biases the
      // language model toward exactly that shape.
      request.taskHint = .search

      var settled = false
      recognizer.recognitionTask(with: request) { result, error in
        guard !settled else { return }

        if let error {
          settled = true
          promise.resolve(Self.failure("recognition_failed", error.localizedDescription))
          return
        }
        guard let result, result.isFinal else { return }

        settled = true
        promise.resolve([
          "ok": true,
          "transcript": result.bestTranscription.formattedString,
          // Apple's own confidence over the segments, averaged. Reported rather
          // than acted on here — the screen decides what to do with a low one.
          "confidence": Self.averageConfidence(result.bestTranscription),
          "onDevice": true,
        ])
      }
    }
  }

  // MARK: - Helpers

  private static func failure(_ reason: String, _ detail: String?) -> [String: Any?] {
    ["ok": false, "reason": reason, "detail": detail, "onDevice": false]
  }

  private static func authorizationLabel(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "not_determined"
    @unknown default: return "not_determined"
    }
  }

  private static func averageConfidence(_ transcription: SFTranscription) -> Double {
    let segments = transcription.segments
    guard !segments.isEmpty else { return 0 }
    let total = segments.reduce(0.0) { $0 + Double($1.confidence) }
    return total / Double(segments.count)
  }
}
