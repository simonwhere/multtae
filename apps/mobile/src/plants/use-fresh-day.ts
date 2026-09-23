import { useEffect } from 'react';
import { AppState } from 'react-native';

import { msUntilNextDay } from './day-boundary';

/** 자정을 넘기면 한 박자 뒤에 읽는다. 시계와 화면이 어긋나지 않게 */
const AFTER_MIDNIGHT = 1_000;

/**
 * 날이 바뀌면, 그리고 앱이 앞으로 올 때마다 다시 읽는다.
 * 오늘 탭을 열어 둔 채 자정을 넘기거나 밤새 뒤로 두었다가 돌아오면 어제 날짜가 남아 있었다.
 */
export function useFreshDay(reload: () => void): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const arm = () => {
      const now = Date.now();
      const wait = msUntilNextDay(now, -new Date(now).getTimezoneOffset()) + AFTER_MIDNIGHT;
      timer = setTimeout(() => {
        reload();
        arm();
      }, wait);
    };
    arm();

    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // 뒤에 있는 동안 날이 바뀌었을 수 있고, 알림을 다시 짜면서 다음 물주기가 바뀌었을 수도 있다
      reload();
      clearTimeout(timer);
      arm();
    });

    return () => {
      clearTimeout(timer);
      appState.remove();
    };
  }, [reload]);
}
