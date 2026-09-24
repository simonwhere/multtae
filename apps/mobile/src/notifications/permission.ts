/** 알림 권한 상태를 앱이 쓰는 세 가지로 읽는다. expo-notifications 에 기대지 않는 순수 함수 */

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** expo-notifications 의 권한 응답에서 쓰는 값만 */
export interface PermissionResponse {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  /** iOS 의 임시 허용(provisional·ephemeral)도 알림을 띄울 수 있다 */
  provisional: boolean;
}

/**
 * asked 는 이 기기에서 권한 창을 띄운 적이 있는지 (settings.notification_asked).
 * 안드로이드 13 이상은 한 번도 묻지 않았어도 거부로 알려 온다. 물은 적이 없고 물을 수 있으면
 * 아직 답하지 않은 것으로 본다. 그래야 권한 창을 띄우고, 묻기 전에 꺼져 있다는 배너가 뜨지 않는다 (9-4).
 */
export function readPermission(response: PermissionResponse, asked: boolean): PermissionState {
  if (response.granted || response.provisional) return 'granted';
  if (response.status === 'undetermined') return 'undetermined';
  return !asked && response.canAskAgain ? 'undetermined' : 'denied';
}
