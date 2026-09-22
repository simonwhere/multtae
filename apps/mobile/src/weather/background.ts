/**
 * 백그라운드 작업 (SPEC.md 7.1, 12). 앱을 열지 않아도 날씨를 받고 14일치 알림을 다시 짠다.
 *
 * 명세는 06시·18시 두 번이지만 iOS·안드로이드 모두 정확한 시각을 보장하지 않는다. 최소 간격만 6시간으로
 * 정하고 시각은 기기가 고르게 둔다. 날씨는 서버 캐시가 있어 자주 돌아도 호출이 늘지 않는다.
 *
 * Expo Go 의 iOS 에서는 백그라운드 작업이 돌지 않는다. 개발 빌드나 실기기에서 확인한다.
 * 작업 정의는 앱이 깨어날 때 바로 있어야 해서 이 파일을 루트 레이아웃이 불러 둔다.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { rescheduleNow } from '@/notifications/reschedule';

import { syncWeather } from './sync';

export const BACKGROUND_TASK = 'multtae-refresh';
const MINIMUM_INTERVAL_MINUTES = 6 * 60;

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    await syncWeather();
    // 날씨가 그대로여도 날짜가 바뀌었으면 밀림·계절 전환 알림을 다시 짜야 한다
    await rescheduleNow();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** 기기가 허락하면 작업을 등록한다. 허락하지 않으면 앱을 열 때만 받는다 */
export async function registerBackgroundTask(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK))) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
        minimumInterval: MINIMUM_INTERVAL_MINUTES,
      });
    }
    return true;
  } catch {
    return false;
  }
}
