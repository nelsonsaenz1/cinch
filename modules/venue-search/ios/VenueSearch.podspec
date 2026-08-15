Pod::Spec.new do |s|
  s.name           = 'VenueSearch'
  s.version        = '1.0.0'
  s.summary        = 'Device-local MapKit point-of-interest search for the Where field.'
  s.description    = 'Local Expo module: one MKLocalSearch pass per settled query, ' \
                     'returning bounded serialisable venue records. No vendor, no ' \
                     'imagery, no network of Cinch\'s own.'
  s.author         = 'Cinch'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }
  # Matches the app's deployment target and GarmentCutout's. MKLocalSearch
  # itself is far older; 17.0 is here so the two local pods agree.
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
