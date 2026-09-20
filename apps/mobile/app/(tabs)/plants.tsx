import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { PlantCard } from '@/plants/plant-card';
import { classifyPlant } from '@/plants/today';
import { nowContext } from '@/plants/use-now';
import { useGarden } from '@/plants/use-plants';
import { AppText, spacing, useColors } from '@/ui';

// 식물 탭 (SPEC 3.4): 다음 물주기순 목록. 정렬·필터와 식물 상세는 2-5 에서 채운다.
export default function PlantsScreen() {
  const colors = useColors();
  const { garden } = useGarden();
  const context = nowContext(garden?.loadedAt);

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
        <ScrollView contentContainerStyle={styles.list}>
          {garden.plants.map((item) => (
            <PlantCard
              key={item.plant.id}
              {...item}
              soil={classifyPlant(item.plant, context.now, context.utcOffsetMinutes)}
            />
          ))}
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
  },
  list: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
});
