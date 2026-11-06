Pod::Spec.new do |s|
  s.name = 'ShotOcr'
  s.version = '1.0.0'
  s.summary = 'On-device text recognition for Shot Remind'
  s.description = s.summary
  s.author = 'Shot Remind'
  s.homepage = 'https://expo.dev'
  s.license = { :type => 'MIT', :file => '../../../LICENSE' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
