import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { PlantRow } from '@/plants/plant-row';
import type { PlantWithSpace } from '@/db/plants';
import { nowContext } from '@/plants/use-now';
import { useGarden } from '@/plants/use-plants';
import { AppText, spacing, useColors } from '@/ui';

// 식물 탭 (SPEC 3.4): 다음 물주기순 목록. 카드를 누르면 식물 상세로 간다. 정렬·필터는 아직 없다.
export default function PlantsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { garden } = useGarden();
  const context = nowContext(garden?.loadedAt);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/plant/[id]', params: { id } }),
    [router],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.plantsTab.title}
      </AppText>
      {garden === null ? null : garden.plants.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.plantsTab.empty}</AppText>
        </View>
      ) : (
        // 식물이 많아도 보이는 만큼만 그린다 (SPEC 15 성능)
        <FlatList
          data={garden.plants}
          keyExtractor={keyOf}
          renderItem={({ item }) => (
            <PlantRow
              item={item}
              now={context.now}
              utcOffsetMinutes={context.utcOffsetMinutes}
              onPress={open}
            />
          )}
          ItemSeparatorComponent={Gap}
          contentContainerStyle={styles.list}
          initialNumToRender={6}
        />
      )}
    </SafeAreaView>
  );
}

const keyOf = (item: PlantWithSpace) => item.plant.id;
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
