import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { AppText, spacing, useColors } from '@/ui';

// 오늘 탭의 빈 상태 (SPEC 3.2). 카드·등록 플로우는 2주차 태스크에서 채운다.
export default function TodayScreen() {
  const colors = useColors();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg">{ko.today.title}</AppText>
      <View style={styles.empty}>
        <AppText>{ko.today.empty}</AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingTop: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
