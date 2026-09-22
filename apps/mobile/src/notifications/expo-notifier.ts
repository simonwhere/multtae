/**
 * expo-notifications 를 쓰는 쪽은 이 파일에 모은다. 모든 알림은 기기 로컬 알림이고 푸시 서버가 없다 (SPEC.md 12).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ko } from '@/i18n/ko';

import type { PlannedNotification } from './plan';
import type { Notifier } from './scheduler';

const WATERING_CHANNEL = 'watering';
const MINUTES_PER_HOUR = 60;

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toPermissionState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  const ios = status.ios?.status;
  // iOS 의 임시 허용도 알림을 띄울 수 있다
  const provisional =
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL;

  if (status.granted || provisional) return 'granted';
  return status.status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function getPermissionState(): Promise<PermissionState> {
  return toPermissionState(await Notifications.getPermissionsAsync());
}

/** 시스템 권한 창을 띄운다. 이미 답한 적이 있으면 창 없이 그 답이 돌아온다 */
export async function requestPermission(): Promise<PermissionState> {
  // 안드로이드 13 이상은 채널이 있어야 권한 창이 뜬다
  await prepareChannel();
  return toPermissionState(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }),
  );
}

export async function prepareChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(WATERING_CHANNEL, {
    name: ko.notifications.channel,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** 앱을 보고 있을 때 온 알림도 배너로 보여 준다 */
export function showNotificationsInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // 안드로이드는 소리를 끄면 배너도 뜨지 않는다
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export const expoNotifier: Notifier = {
  canNotify: async () => (await getPermissionState()) === 'granted',
  scheduledIds: async () =>
    (await Notifications.getAllScheduledNotificationsAsync()).map((request) => request.identifier),
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  schedule: async ({ id, title, body, target, eventId, date, minuteOfDay }: PlannedNotification) => {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: 'default', data: { target, eventId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        // 기기 시간대의 그 날짜 그 시각 (12.2 시간대)
        date: new Date(
          date.year,
          date.month - 1,
          date.day,
          Math.floor(minuteOfDay / MINUTES_PER_HOUR),
          minuteOfDay % MINUTES_PER_HOUR,
        ),
        channelId: WATERING_CHANNEL,
      },
    });
  },
};
