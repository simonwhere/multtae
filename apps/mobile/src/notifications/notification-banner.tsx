import { Linking, StyleSheet, View } from 'react-native';

import { ko } from '@/i18n/ko';
import { AppText, radius, spacing, TextButton, useColors } from '@/ui';

import { useNotificationState } from './store';

/** 알림 권한이 꺼져 있을 때 오늘 탭 상단에 띄운다. 앱 안의 기능은 그대로 쓸 수 있다 (SPEC 12.2 권한 없음) */
export function NotificationBanner() {
  const colors = useColors();
  const permission = useNotificationState((state) => state.permission);

  if (permission !== 'denied') return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.berryTint }]}>
      <View style={styles.text}>
        <AppText variant="label">{ko.notifications.offTitle}</AppText>
        <AppText variant="caption" color={colors.ink}>
          {ko.notifications.offBody}
        </AppText>
      </View>
      <TextButton label={ko.notifications.openSettings} onPress={() => void Linking.openSettings()} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.control,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
});
