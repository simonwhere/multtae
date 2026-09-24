import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * 안드로이드 위젯 모듈이 든 빌드인지. Expo Go 에는 없고, 없는데 위젯 라이브러리를 읽으면
 * 앱이 멈춘다. 그래서 위젯 코드는 이것을 확인한 뒤에만 불러온다.
 */
export function androidWidgetAvailable(): boolean {
  return Platform.OS === 'android' && TurboModuleRegistry.get('AndroidWidget') != null;
}
