import ExpoModulesCore
import Foundation
import MapKit

/**
 Nearby venue suggestions, entirely on this device (LP-05).

 A SEPARATE local module rather than a third module inside `garment-cutout`:
 that pod exists to decode one garment photograph and measure it, it links
 Vision and CoreImage, and nothing in it is shared with a map search. Two
 concerns that share no code and no decode path get two pods.

 ── MKLocalSearch, not MKLocalSearchCompleter ──────────────────────────────

 The brief names both. Only one of them can answer the question this field
 actually asks. `MKLocalSearchCompleter` streams `title`/`subtitle` strings
 through a delegate and carries NO coordinates — every row a user might tap
 would need a second `MKLocalSearch` to become storable, so the cheap-looking
 API is two round trips per selection and a delegate lifetime to manage across
 a cancel. `MKLocalSearch` with `resultTypes = [.pointOfInterest, .address]`
 returns the same ranked set already resolved: name, placemark, coordinate,
 point-of-interest category. One call, one cancel, one completion.

 The completer's real advantage — per-keystroke streaming — is not wanted
 here anyway: JavaScript debounces the query (`venue-search.ts`) precisely so
 MapKit is asked once the typing stops, which is also what keeps this well
 inside MapKit's own throttle.

 ── What crosses the bridge ────────────────────────────────────────────────

 BOUNDED SERIALISABLE VALUES ONLY. An identifier when the OS offers one, a
 name, a short address line, two doubles, and a category string. No MKMapItem,
 no placemark object, no imagery, no URL. Nothing here is written anywhere but
 the event row the user creates, and nothing here is logged.

 AN ENVELOPE, NOT AN EXCEPTION. Failure is an ordinary outcome for a search
 field — the network is off, MapKit throttled, the query matched nothing — and
 each of those is a different quiet line in the UI. Rejecting the promise would
 flatten them into one caught error and force the caller to parse a message to
 tell "no matches" from "no signal". Same shape `LocalSpeech.transcribe`
 already uses in this repo, for the same reason.
 */

/// Region bias and the result cap. Every field optional so a call with no
/// permission and no coordinates is the natural default rather than a special
/// case: MapKit then picks its own region and the search still works.
internal struct VenueSearchOptions: Record {
  @Field
  var latitude: Double?

  @Field
  var longitude: Double?

  /// The span of the bias box. 40km is "this city and its suburbs" — wide
  /// enough that a venue across town still ranks, narrow enough that the
  /// bias means something.
  @Field
  var radiusMeters: Double = 40_000

  /// Asked of MapKit; the JavaScript side caps again after deduping, because
  /// dedupe can only ever remove rows.
  @Field
  var limit: Int = 10
}

public final class VenueSearchModule: Module {
  /// The one in-flight search, cancelled by the next one.
  ///
  /// JavaScript already drops late replies (latest-request-wins), so this is
  /// not about correctness — it is about not holding MapKit's throttle budget
  /// open for an answer nobody will read.
  private var current: MKLocalSearch?

  public func definition() -> ModuleDefinition {
    Name("VenueSearch")

    /// Whether this build can search at all. Always true where the module is
    /// linked; the honest `false` is the module being absent entirely, which
    /// `requireOptionalNativeModule` reports on the JavaScript side.
    Function("isAvailable") { () -> Bool in
      true
    }

    /**
     One search for one settled query.

     `runOnQueue(.main)` because MapKit's request objects are not documented as
     thread-safe and `start(completionHandler:)` calls back on the main queue
     regardless; doing the whole thing there removes the question.
     */
    AsyncFunction("search") { (query: String, options: VenueSearchOptions?, promise: Promise) in
      let options = options ?? VenueSearchOptions()
      let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

      // An empty query is not an error and not a search. Returning the empty
      // envelope keeps the caller's branch count at one.
      guard !trimmed.isEmpty else {
        promise.resolve(Self.envelope(venues: []))
        return
      }

      self.current?.cancel()

      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = trimmed
      // Points of interest are the feature; addresses are here because "a
      // friend's flat" is a real answer to Where and MapKit will resolve the
      // street even when no business sits on it.
      request.resultTypes = [.pointOfInterest, .address]

      if let latitude = options.latitude, let longitude = options.longitude {
        request.region = MKCoordinateRegion(
          center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
          latitudinalMeters: options.radiusMeters,
          longitudinalMeters: options.radiusMeters
        )
      }

      let search = MKLocalSearch(request: request)
      self.current = search

      search.start { response, error in
        if let error = error as NSError? {
          promise.resolve(Self.failure(from: error))
          return
        }

        guard let response else {
          promise.resolve(Self.envelope(venues: []))
          return
        }

        let venues =
          response.mapItems
          .compactMap { Self.record(from: $0) }
          .prefix(max(options.limit, 0))

        promise.resolve(Self.envelope(venues: Array(venues)))
      }
    }.runOnQueue(.main)
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  private static func envelope(venues: [[String: Any?]]) -> [String: Any?] {
    ["ok": true, "venues": venues, "reason": nil]
  }

  /**
   MapKit's error, reduced to the four things the field can actually say.

   `placemarkNotFound` is deliberately NOT a failure: MapKit is telling us the
   query matched nothing, which is a result, and the field's own "no matches"
   line already says it without implying anything broke.
   */
  private static func failure(from error: NSError) -> [String: Any?] {
    if error.domain == MKErrorDomain {
      switch error.code {
      case MKError.placemarkNotFound.rawValue, MKError.directionsNotFound.rawValue:
        return envelope(venues: [])
      case MKError.loadingThrottled.rawValue:
        return ["ok": false, "venues": [[String: Any?]](), "reason": "throttled"]
      default:
        break
      }
    }

    if error.domain == NSURLErrorDomain {
      switch error.code {
      case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost,
        NSURLErrorTimedOut, NSURLErrorCannotConnectToHost, NSURLErrorDataNotAllowed:
        return ["ok": false, "venues": [[String: Any?]](), "reason": "offline"]
      default:
        break
      }
    }

    return ["ok": false, "venues": [[String: Any?]](), "reason": "error"]
  }

  /// One map item as the bounded record. `nil` for anything unnameable — a
  /// row whose first line is blank is not a suggestion.
  private static func record(from item: MKMapItem) -> [String: Any?]? {
    guard let name = item.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty
    else { return nil }

    let placemark = item.placemark
    let coordinate = placemark.coordinate
    guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }

    var identifier: String?
    if #available(iOS 18.0, *) {
      identifier = item.identifier?.rawValue
    }

    return [
      // Stable across launches when the OS offers it (iOS 18+); nil below
      // that, where the JavaScript side dedupes on name and locality instead.
      "id": identifier,
      "name": name,
      "locality": shortAddress(placemark),
      "latitude": coordinate.latitude,
      "longitude": coordinate.longitude,
      "category": item.pointOfInterestCategory?.rawValue,
    ]
  }

  /**
   The second line of a row: at most two address parts, nearest first.

   Not `CNPostalAddressFormatter`, which produces a multi-line mailing address
   — this line sits under a venue name in a 48pt row and has to stay one line
   at accessibility sizes.
   */
  private static func shortAddress(_ placemark: MKPlacemark) -> String? {
    let street = [placemark.subThoroughfare, placemark.thoroughfare]
      .compactMap { $0 }
      .joined(separator: " ")

    let parts = [
      street.isEmpty ? nil : street,
      placemark.locality,
      placemark.administrativeArea,
    ].compactMap { $0 }

    let line = parts.prefix(2).joined(separator: ", ")
    return line.isEmpty ? nil : line
  }
}
