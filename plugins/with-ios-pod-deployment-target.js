const { withPodfile } = require('expo/config-plugins');

module.exports = function withIosPodDeploymentTarget(config) {
  return withPodfile(config, mod => {
    const marker = '  post_install do |installer|';
    const contents = mod.modResults.contents;
    if (contents.includes('# Align pod resource bundles with the app deployment target.')) return mod;
    if (!contents.includes(marker)) throw new Error('Missing post_install hook in the Expo Podfile.');

    // React Native raises native library targets but leaves some resource bundles untouched.
    mod.modResults.contents = contents.replace(marker, `${marker}
    # Align pod resource bundles with the app deployment target.
    app_minimum = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '16.4')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |configuration|
        settings = configuration.build_settings
        target_minimum = settings['IPHONEOS_DEPLOYMENT_TARGET']
        if target_minimum && Gem::Version.correct?(target_minimum) && Gem::Version.new(target_minimum) < app_minimum
          settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_minimum.to_s
        end
      end
    end`);
    return mod;
  });
};
