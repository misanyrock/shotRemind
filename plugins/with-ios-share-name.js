const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const plist = require('@expo/plist').default;
const { withXcodeProject } = require('expo/config-plugins');

module.exports = config => withXcodeProject(config, mod => {
  const filename = join(mod.modRequest.platformProjectRoot, 'expo-sharing-extension', 'Info.plist');
  const info = plist.parse(readFileSync(filename, 'utf8'));
  info.CFBundleDisplayName = config.name;
  writeFileSync(filename, plist.build(info));
  return mod;
});
