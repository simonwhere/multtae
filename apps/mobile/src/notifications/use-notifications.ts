import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { prepareChannel, showNotificationsInForeground } from './expo-notifier';
import { refreshPermission, rescheduleSoon } from './reschedule';

showNotificationsInForeground();

/**
 * 앱이 앞으로 올 때마다 권한을 다시 확인하고 알림을 다시 예약한다 (SPEC.md 12).
 * DB 를 읽으므로 마이그레이션이 끝난 뒤(ready)에만 돈다.
 */
export function useNotifications(ready: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    const refresh = () => {
      void refreshPermission();
      rescheduleSoon();
    };
    void prepareChannel();
    refresh();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // 알림은 오늘 탭으로, 진단 재확인은 그 진단 결과로 간다 (12.1). 열려 있던 시트와 등록 화면은 닫는다
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data as
        | { target?: unknown; eventId?: unknown }
        | undefined;
      if (data?.target !== 'today' && data?.target !== 'diagnosis') return;
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/');
      if (data.target === 'diagnosis' && typeof data.eventId === 'string') {
        router.push({ pathname: '/diagnosis/[eventId]', params: { eventId: data.eventId } });
      }
    });

    return () => {
      appState.remove();
      response.remove();
    };
  }, [ready, router]);
}
