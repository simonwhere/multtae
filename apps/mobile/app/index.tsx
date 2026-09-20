import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import type { Space } from '@/db/schema';
import { listSpaces } from '@/db/spaces';
import { ko } from '@/i18n/ko';
import { MAX_SPACES } from '@/spaces/registration';
import { SpaceCard } from '@/spaces/space-card';
import { AppText, Button, Notice, spacing, useColors } from '@/ui';

// 오늘 탭 (SPEC 3.2). 식물 카드는 2-3 에서 채운다.
// 공간 탭(4-5)이 생기기 전까지는 등록한 공간을 여기서 보여 준다.
export default function TodayScreen() {
  const colors = useColors();
  const router = useRouter();
  /** null 은 불러오는 중 */
  const [spaces, setSpaces] = useState<Space[] | null>(null);

  // 등록 모달에서 돌아올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void listSpaces(db).then((rows) => {
        if (alive) setSpaces(rows);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const register = () => router.push('/register/space');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.today.title}
      </AppText>
      {spaces === null ? null : spaces.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.today.empty}</AppText>
          <Button label={ko.today.registerSpace} onPress={register} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <AppText variant="formula">{ko.today.spaces}</AppText>
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
          {spaces.length >= MAX_SPACES ? (
            <Notice message={ko.today.spaceLimit} />
          ) : (
            <Button label={ko.today.addSpace} variant="secondary" onPress={register} />
          )}
        </ScrollView>
      )}
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
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
});
