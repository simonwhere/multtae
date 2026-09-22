/**
 * 앱에서 날씨를 받는 곳 (SPEC.md 7.1, 12.3 트리거). 앱 진입, 지역 변경, 백그라운드 작업이 부른다.
 * 새 예보를 받으면 알림을 다시 짠다. 날씨 규칙(7.2)이 알림 시각과 물주기를 바꿀 수 있어서다.
 */
import { fetchWeather } from '@/api/weather';
import { db } from '@/db/client';
import { rescheduleNow } from '@/notifications/reschedule';
import { coalesce } from '@/notifications/scheduler';

import { loadCachedWeather, refreshWeather } from './refresh';
import { useWeatherState } from './store';

let forceNext = false;

const run = coalesce(async () => {
  const force = forceNext;
  forceNext = false;

  const result = await refreshWeather(db, fetchWeather, { force });
  const { setWeather } = useWeatherState.getState();
  if (result.status === 'no_region') {
    setWeather(null);
    return;
  }
  setWeather(result.weather, result.status === 'not_configured');
  if (result.status === 'updated') await rescheduleNow();
});

/** 저장해 둔 날씨를 먼저 화면에 올린다. 서버를 기다리지 않는다 */
export async function showCachedWeather(): Promise<void> {
  const cached = await loadCachedWeather(db);
  if (cached && !useWeatherState.getState().weather) useWeatherState.getState().setWeather(cached);
}

/** 날씨를 받는다. 실패해도 앱은 그대로 돈다. force 면 3시간이 안 됐어도 묻는다(지역을 바꿨을 때) */
export async function syncWeather(force = false): Promise<void> {
  if (force) forceNext = true;
  try {
    await run();
  } catch (error) {
    if (__DEV__) console.warn('syncWeather', error);
  }
}
