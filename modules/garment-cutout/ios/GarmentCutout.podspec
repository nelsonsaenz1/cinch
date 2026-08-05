Pod::Spec.new do |s|
  s.name           = 'GarmentCutout'
  s.version        = '1.0.0'
  s.summary        = 'Vision subject lifting, plate normalization and palette sampling.'
  s.description    = 'Local Expo module: one native pass per garment photo producing ' \
                     'transparent cutouts, a scale-normalized plate render, and a ' \
                     'measured colour histogram.'
  s.author         = 'Cinch'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }
  # 17.0 rather than the SDK default: VNGenerateForegroundInstanceMaskRequest
  # does not exist below it, and the app already targets 17.0.
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
