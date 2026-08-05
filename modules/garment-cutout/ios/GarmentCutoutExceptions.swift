import ExpoModulesCore

/**
 Failures worth naming.

 Deliberately short list. "No subject" is NOT here — an unliftable photo is an
 ordinary outcome the JS layer reports as a result, not an exception, because
 throwing for it would put a normal flat-lay through the same path as a corrupt
 file and the caller would have to parse messages to tell them apart.
 */
internal final class ImageDecodeFailedException: GenericException<String> {
  override var reason: String {
    "Could not decode an image at \(param)"
  }
}

internal final class PNGEncodingFailedException: GenericException<String> {
  override var reason: String {
    "Could not encode \(param) as PNG"
  }
}

internal final class CacheDirectoryUnavailableException: Exception {
  override var reason: String {
    "No cache directory is available to write cutouts into"
  }
}
