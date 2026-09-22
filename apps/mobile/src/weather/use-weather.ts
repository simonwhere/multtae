import { useEffect } from 'react';
import { AppState } from 'react-native';

import { registerBackgroundTask } from './background';
import { showCachedWeather, syncWeather } from './sync';

/**
 * 앱이 앞으로 올 때마다 날씨를 받는다 (SPEC.md 7.1). 서버 캐시가 3시간이라 그 안에는 다시 묻지 않는다.
 * DB 를 읽으므로 마이그레이션이 끝난 뒤(ready)에만 돈다.
 */
export function useWeather(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;

    void showCachedWeather().then(() => syncWeather());
    void registerBackgroundTask();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncWeather();
    });
    return () => appState.remove();
  }, [ready]);
}
