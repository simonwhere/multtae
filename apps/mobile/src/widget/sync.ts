/**
 * 홈 화면 위젯에 오늘부터 일주일치를 넘긴다 (9-3). 알림을 다시 짤 때마다 함께 불러
 * 앱 진입, 물 줬어요, 내일로, 등록·편집, 가져오기 뒤에 위젯도 같이 바뀐다.
 * 위젯 모듈이 없는 곳(Expo Go)에서는 아무것도 하지 않는다.
 */
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

import { db } from '@/db/client';
import { listPlantsWithSpace } from '@/db/plants';

import { androidWidgetAvailable } from './android/available';
import { WIDGET_APP_GROUP, WIDGET_KEY, buildWidgetSnapshot } from './snapshot';

export async function syncWidget(now: number, utcOffsetMinutes: number): Promise<void> {
  const android = androidWidgetAvailable();
  if (Platform.OS !== 'ios' && !android) return;

  const items = await listPlantsWithSpace(db);
  const text = JSON.stringify(buildWidgetSnapshot(items, now, utcOffsetMinutes));

  if (android) {
    const { updateAndroidWidget } = await import('./android/update');
    await updateAndroidWidget(text);
    return;
  }
  new ExtensionStorage(WIDGET_APP_GROUP).set(WIDGET_KEY, text);
  ExtensionStorage.reloadWidget();
}
