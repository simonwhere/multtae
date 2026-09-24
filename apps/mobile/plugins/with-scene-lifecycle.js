/**
 * iOS 27 SDK(Xcode 27)로 빌드한 앱은 UIScene 수명 주기를 쓰지 않으면 켜지자마자 멈춘다.
 * Expo 57 은 이를 위한 ExpoAppSceneDelegate 를 갖고 있지만 prebuild 기본 틀이 아직 쓰지 않아서
 * 여기서 켠다: 창을 만들고 React Native 를 올리는 일을 AppDelegate 에서 장면 쪽으로 넘긴다.
 * 기본 틀이 장면을 쓰게 바뀌면 이 플러그인은 아무것도 하지 않는다.
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const PROVIDER = 'ExpoReactNativeFactoryProvider';

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        // expo 의 ExpoAppSceneDelegate (@objc 이름)
        UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
      },
    ],
  },
};

/** AppDelegate 가 창을 만들고 React Native 를 올리던 부분. 장면이 대신 한다 */
const START_IN_APP_DELEGATE =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function adoptScenes(contents) {
  if (contents.includes(PROVIDER) || contents.includes('UIWindowSceneDelegate')) return contents;

  const declaration = 'class AppDelegate: ExpoAppDelegate {';
  if (!contents.includes(declaration) || !START_IN_APP_DELEGATE.test(contents)) {
    throw new Error(
      'with-scene-lifecycle: AppDelegate.swift 모양이 예상과 달라 장면 수명 주기를 켜지 못했습니다. ' +
        'Expo 기본 틀이 바뀌었는지 확인해 주세요.',
    );
  }
  return contents
    .replace(declaration, `class AppDelegate: ExpoAppDelegate, ${PROVIDER} {`)
    .replace(START_IN_APP_DELEGATE, '\n');
}

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (plist) => {
    plist.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return plist;
  });
  return withAppDelegate(config, (delegate) => {
    if (delegate.modResults.language !== 'swift') return delegate;
    delegate.modResults.contents = adoptScenes(delegate.modResults.contents);
    return delegate;
  });
};

module.exports.adoptScenes = adoptScenes;
