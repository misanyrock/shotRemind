const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

module.exports = function withIosScene(config) {
  config = withInfoPlist(config, mod => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'ShotRemind',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).ShotRemindSceneDelegate',
        }],
      },
    };
    return mod;
  });

  return withAppDelegate(config, mod => {
    const { contents } = mod.modResults;
    if (contents.includes('class ShotRemindSceneDelegate:')) return mod;
    const startup = /#if os\(iOS\) \|\| os\(tvOS\)\n    window = UIWindow[\s\S]+?\n#endif\n\n/;
    if (!startup.test(contents)) throw new Error('Unexpected SDK 56 AppDelegate startup block.');

    mod.modResults.contents = contents.replace(startup, '') + `
class ShotRemindSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let delegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = delegate.reactNativeFactory else { return }

    let sceneWindow = UIWindow(windowScene: windowScene)
    window = sceneWindow
    delegate.window = sceneWindow

    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let context = options.urlContexts.first {
      launchOptions[.url] = context.url
    }
    factory.startReactNative(withModuleName: "main", in: sceneWindow, launchOptions: launchOptions)

    for activity in options.userActivities {
      self.scene(scene, continue: activity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    let application = UIApplication.shared
    guard let delegate = application.delegate as? AppDelegate else { return }

    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
      options[.sourceApplication] = context.options.sourceApplication
      options[.annotation] = context.options.annotation
      _ = delegate.application(application, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue activity: NSUserActivity) {
    let application = UIApplication.shared
    guard let delegate = application.delegate as? AppDelegate else { return }
    _ = delegate.application(application, continue: activity, restorationHandler: { _ in })
  }
}
`;
    return mod;
  });
};
