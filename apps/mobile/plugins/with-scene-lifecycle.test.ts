import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { adoptScenes } = require('./with-scene-lifecycle.js') as {
  adoptScenes: (contents: string) => string;
};

/** expo prebuild 기본 틀(SDK 57)의 AppDelegate.swift 에서 바뀌는 부분 */
const TEMPLATE = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('with-scene-lifecycle: iOS 27 SDK 로 빌드해도 켜진다', () => {
  const adopted = adoptScenes(TEMPLATE);

  it('창과 React Native 는 장면이 만들고, AppDelegate 는 만든 factory 를 넘겨준다', () => {
    expect(adopted).toContain('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    expect(adopted).not.toContain('UIWindow(frame:');
    expect(adopted).not.toContain('startReactNative');
    expect(adopted).toContain('reactNativeFactory = factory');
    expect(adopted).toContain('return super.application(application, didFinishLaunchingWithOptions: launchOptions)');
  });

  it('두 번 돌려도 같다', () => {
    expect(adoptScenes(adopted)).toBe(adopted);
  });

  it('틀이 예상과 다르면 조용히 넘어가지 않고 멈춘다', () => {
    expect(() => adoptScenes(TEMPLATE.replace('window = UIWindow', 'window = MyWindow'))).toThrow(
      /with-scene-lifecycle/,
    );
  });
});
