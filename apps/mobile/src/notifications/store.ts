import { create } from 'zustand';

import type { PermissionState } from './expo-notifier';

interface NotificationState {
  /** 알림 권한. null 은 아직 확인하지 않았다는 뜻 */
  permission: PermissionState | null;
  setPermission: (permission: PermissionState) => void;
}

export const useNotificationState = create<NotificationState>((set) => ({
  permission: null,
  setPermission: (permission) => set({ permission }),
}));
