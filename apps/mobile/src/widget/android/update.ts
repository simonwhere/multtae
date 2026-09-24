/**
 * 앱이 켜져 있을 때 안드로이드 위젯을 바로 고친다 (9-3). 앱이 꺼진 동안 위젯이 읽도록 파일로도 남긴다.
 * 위젯 라이브러리를 읽으므로 위젯 모듈이 든 빌드에서만 불러야 한다 (./available.ts).
 */
import { requestWidgetUpdate } from 'react-native-android-widget';

import { ANDROID_WIDGET_NAME } from '../snapshot';
import { renderToday, snapshotFile } from './task';

export async function updateAndroidWidget(text: string): Promise<void> {
  const file = snapshotFile();
  if (!file.exists) file.create();
  file.write(text);
  await requestWidgetUpdate({
    widgetName: ANDROID_WIDGET_NAME,
    renderWidget: (info) => renderToday(text, info),
  });
}
