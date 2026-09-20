import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { typography } from '@/ui/tokens';
import { useColors } from '@/ui/use-colors';

// 오늘 탭의 빈 상태 (SPEC 3.2). 카드·등록 플로우는 2주차 태스크에서 채운다.
export default function TodayScreen() {
  const colors = useColors();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <Text style={[typography.titleLg, { color: colors.soil.wet }]}>{ko.today.title}</Text>
      <View style={styles.empty}>
        <Text style={[typography.body, { color: colors.soil.wet }]}>{ko.today.empty}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
