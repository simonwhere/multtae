/**
 * 앱에서 rescheduleAll 을 부르는 곳 (SPEC.md 12.3 트리거): 앱 진입, 물주기 기록, 내일로, 식물·공간 편집,
 * 새 날씨, 백그라운드 작업(weather/background.ts).
 */
import { db } from '@/db/client';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { reportError } from '@/telemetry/report';

import { expoNotifier, getPermissionState, requestPermission } from './expo-notifier';
import { coalesce, rescheduleAll } from './scheduler';
import { useNotificationState } from './store';

const requestReschedule = coalesce(async () => {
  const { now, utcOffsetMinutes, coefficients } = nowContext();
  const result = await rescheduleAll(db, expoNotifier, { now, utcOffsetMinutes, coefficients });
  // 계절이 바뀌어 다음 물주기를 고쳐 썼으면 열려 있는 화면이 다시 읽게 한다
  if (result.updatedPlants > 0) usePlantUi.getState().bumpGarden();
});

/** 알림을 다시 예약하고 끝날 때까지 기다린다. 백그라운드 작업처럼 끝을 알려야 하는 곳에서 쓴다 */
export async function rescheduleNow(): Promise<void> {
  try {
    await requestReschedule();
  } catch (error) {
    reportError({ where: 'notifications.reschedule', error });
  }
}

/** 알림을 다시 예약한다. 실패해도 앱 기능은 그대로여야 하므로 기다리지도 던지지도 않는다 */
export function rescheduleSoon(): void {
  requestReschedule().catch((error: unknown) => {
    reportError({ where: 'notifications.reschedule', error });
  });
}

export async function refreshPermission(): Promise<void> {
  useNotificationState.getState().setPermission(await getPermissionState());
}

/**
 * 아직 묻지 않았으면 알림 권한을 묻는다. 식물이 생긴 뒤에 불러서, 왜 묻는지 알 수 있을 때 묻는다.
 * 거부해도 앱은 그대로 쓸 수 있고 오늘 탭에 배너가 뜬다 (12.2 권한 없음).
 */
export async function askPermissionOnce(): Promise<void> {
  const { setPermission } = useNotificationState.getState();
  // 앱을 막 켠 때에는 저장해 둔 상태가 아직 비어 있을 수 있어서 직접 확인한다
  const current = await getPermissionState();
  setPermission(current);
  if (current !== 'undetermined') return;

  setPermission(await requestPermission());
  rescheduleSoon();
}
