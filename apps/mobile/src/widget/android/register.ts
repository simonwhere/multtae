import { androidWidgetAvailable } from './available';

/** 안드로이드 위젯이 앱이 꺼져 있을 때 부를 작업을 등록한다. 앱 진입점(index.ts)에서 한 번 부른다 */
export function registerAndroidWidget(): void {
  if (!androidWidgetAvailable()) return;
  // 위젯 모듈이 없는 곳에서 읽히지 않게 여기서 불러온다
  const { registerWidgetTaskHandler } =
    require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { widgetTaskHandler } = require('./task') as typeof import('./task');
  registerWidgetTaskHandler(widgetTaskHandler);
}
