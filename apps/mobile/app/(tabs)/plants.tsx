import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PlantWithSpace } from '@/db/plants';
import type { Space } from '@/db/schema';
import { ko } from '@/i18n/ko';
import { PlantRow } from '@/plants/plant-row';
import { nowContext } from '@/plants/use-now';
import { useGarden } from '@/plants/use-plants';
import { spaceCardLabel } from '@/spaces/format';
import { AppText, Button, Chevron, LightGauge, spacing, useColors } from '@/ui';

/** 공간 제목 한 줄과 그 아래 식물들. 식물이 많아도 보이는 만큼만 그리려고 한 줄로 편다 (SPEC 15 성능) */
type Row =
  | { kind: 'space'; key: string; space: Space; count: number }
  | { kind: 'plant'; key: string; item: PlantWithSpace }
  | { kind: 'spaceEmpty'; key: string };

function rowsOf(spaces: readonly Space[], plants: readonly PlantWithSpace[]): Row[] {
  const rows: Row[] = [];
  for (const space of spaces) {
    const mine = plants.filter((item) => item.space.id === space.id);
    rows.push({ kind: 'space', key: `space-${space.id}`, space, count: mine.length });
    for (const item of mine) rows.push({ kind: 'plant', key: item.plant.id, item });
    if (mine.length === 0) rows.push({ kind: 'spaceEmpty', key: `empty-${space.id}` });
  }
  return rows;
}

/** 공간 제목 줄. 누르면 공간 상세 (SPEC 3.3) */
function SpaceHeader({ space, count, onPress }: { space: Space; count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${spaceCardLabel(space, count)}, ${ko.plantsTab.openSpace(space.name)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.spaceHeader, pressed && styles.pressed]}>
      <View style={styles.spaceText}>
        <AppText variant="titleSm" numberOfLines={1}>
          {space.name}
        </AppText>
        <View style={styles.spaceMeta}>
          <AppText variant="caption">{ko.lightGrade[space.lightGrade]}</AppText>
          <LightGauge grade={space.lightGrade} />
          <AppText variant="caption">{ko.spacesTab.plantCount(count)}</AppText>
        </View>
      </View>
      <Chevron />
    </Pressable>
  );
}

// 식물 탭 (SPEC 3.4, 10-4): 공간별로 묶은 식물 목록. 공간 제목을 누르면 공간 상세, 카드를 누르면 식물 상세.
export default function PlantsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { garden } = useGarden();
  const context = nowContext(garden?.loadedAt);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/plant/[id]', params: { id } }),
    [router],
  );
  const openSpace = useCallback(
    (id: string) => router.push({ pathname: '/space/[id]', params: { id } }),
    [router],
  );

  const rows = useMemo(() => (garden ? rowsOf(garden.spaces, garden.plants) : []), [garden]);

  function renderRow(row: Row) {
    if (row.kind === 'space') {
      return <SpaceHeader space={row.space} count={row.count} onPress={() => openSpace(row.space.id)} />;
    }
    if (row.kind === 'spaceEmpty') {
      return (
        <AppText variant="caption" style={styles.spaceEmpty}>
          {ko.plantsTab.spaceEmpty}
        </AppText>
      );
    }
    return (
      <PlantRow
        item={row.item}
        now={context.now}
        utcOffsetMinutes={context.utcOffsetMinutes}
        onPress={open}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.plantsTab.title}
      </AppText>
      {garden === null ? null : garden.spaces.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.plantsTab.noSpace}</AppText>
          <Button label={ko.today.registerSpace} onPress={() => router.push('/register/space')} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item: row }) => renderRow(row)}
          ItemSeparatorComponent={Gap}
          ListFooterComponent={
            garden.plants.length === 0 ? (
              <View style={styles.footer}>
                <Button label={ko.today.registerPlant} onPress={() => router.push('/register/plant')} />
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
          initialNumToRender={8}
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
    gap: spacing.lg,
  },
  list: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
  gap: {
    height: spacing.md,
  },
  spaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
  },
  spaceText: {
    flex: 1,
    gap: spacing.xs,
  },
  spaceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spaceEmpty: {
    marginHorizontal: spacing.xs,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  pressed: {
    opacity: 0.6,
  },
});
