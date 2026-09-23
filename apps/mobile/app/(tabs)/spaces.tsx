import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { useGarden } from '@/plants/use-plants';
import { SpaceCard } from '@/spaces/space-card';
import { AppText, spacing, useColors } from '@/ui';

// 공간 탭 (SPEC 3.3). 카드를 누르면 공간 상세로 간다.
export default function SpacesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { garden } = useGarden();

  // 공간마다 식물을 세느라 목록을 되풀이해 훑지 않게 한 번에 센다 (SPEC 15 성능)
  const counts = useMemo(() => {
    const bySpace = new Map<string, number>();
    for (const { space } of garden?.plants ?? []) {
      bySpace.set(space.id, (bySpace.get(space.id) ?? 0) + 1);
    }
    return bySpace;
  }, [garden]);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.spacesTab.title}
      </AppText>
      {garden === null ? null : garden.spaces.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.spacesTab.empty}</AppText>
        </View>
      ) : (
        <FlatList
          data={garden.spaces}
          keyExtractor={(space) => space.id}
          ItemSeparatorComponent={Gap}
          contentContainerStyle={styles.list}
          renderItem={({ item: space }) => (
            <SpaceCard
              space={space}
              plantCount={counts.get(space.id) ?? 0}
              onPress={() => router.push({ pathname: '/space/[id]', params: { id: space.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const Gap = () => <View style={styles.gap} />;

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
  list: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
  gap: {
    height: spacing.md,
  },
});
