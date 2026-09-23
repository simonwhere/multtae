import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WateringLog } from '@/db/schema';
import { ko } from '@/i18n/ko';
import { nowContext } from '@/plants/use-now';
import { plantStats } from '@/records/stats';
import { buildTimeline, dayTitle, entryText } from '@/records/timeline';
import { useRecords } from '@/records/use-records';
import type { Records } from '@/records/use-records';
import { AppText, Card, Chevron, Chip, spacing, useColors } from '@/ui';

type RecordsView = 'date' | 'plant';

function Timeline({
  records,
  plantId,
  header,
}: {
  records: Records;
  plantId: string | null;
  header: React.ReactElement | null;
}) {
  const colors = useColors();
  const router = useRouter();
  const { utcOffsetMinutes } = nowContext(records.loadedAt);
  const days = buildTimeline(records.waterings, records.events, utcOffsetMinutes, plantId);
  const spaceNames = new Map(records.spaces.map((space) => [space.id, space.name]));

  if (days.length === 0) {
    return (
      <View style={styles.list}>
        {header}
        <View style={styles.empty}>
          <AppText>{plantId ? ko.records.emptyFiltered : ko.records.empty}</AppText>
        </View>
      </View>
    );
  }

  // 기록이 쌓여도 보이는 만큼만 그린다 (SPEC 15 성능)
  return (
    <FlatList
      data={days}
      keyExtractor={(day) => dayTitle(day.date)}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Gap}
      contentContainerStyle={styles.list}
      initialNumToRender={6}
      renderItem={({ item: day }) => (
        <View style={styles.day}>
          <AppText variant="label" accessibilityRole="header" style={styles.dayTitle}>
            {dayTitle(day.date)}
          </AppText>
          <Card style={styles.rows}>
            {day.entries.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.hair }]} /> : null}
                <Pressable
                  // 진단은 눌러서 결과를 다시 본다 (8.1)
                  disabled={!(entry.kind === 'event' && entry.type === 'diagnose')}
                  accessibilityRole={entry.kind === 'event' && entry.type === 'diagnose' ? 'button' : undefined}
                  onPress={() =>
                    router.push({ pathname: '/diagnosis/[eventId]', params: { eventId: entry.id } })
                  }
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  {/* 한 식물만 볼 때는 이름을 되풀이하지 않는다 */}
                  {plantId ? null : (
                    <AppText variant="titleSm" numberOfLines={1} style={styles.name}>
                      {entry.nickname}
                    </AppText>
                  )}
                  <AppText variant={plantId ? 'body' : 'caption'} style={styles.fill}>
                    {entryText(entry, spaceNames)}
                  </AppText>
                  {entry.kind === 'event' && entry.type === 'diagnose' ? <Chevron /> : null}
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      )}
    />
  );
}

function Stats({ records }: { records: Records }) {
  const router = useRouter();
  const context = nowContext(records.loadedAt);
  const t = ko.records;

  if (records.plants.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText>{ko.plantsTab.empty}</AppText>
      </View>
    );
  }

  // 식물마다 기록을 훑지 않게 한 번에 묶는다 (SPEC 15 성능)
  const logsByPlant = new Map<string, WateringLog[]>();
  for (const { log } of records.waterings) {
    const logs = logsByPlant.get(log.plantId);
    if (logs) logs.push(log);
    else logsByPlant.set(log.plantId, [log]);
  }

  return (
    <FlatList
      data={records.plants}
      keyExtractor={({ plant }) => plant.id}
      ItemSeparatorComponent={Gap}
      contentContainerStyle={styles.list}
      initialNumToRender={6}
      renderItem={({ item: { plant, space } }) => {
        const stats = plantStats(plant, space, logsByPlant.get(plant.id) ?? [], context);

        return (
          <Card
            // 카드를 누를 수 있어 안의 글자는 읽히지 않는다. 요약을 라벨에 담는다 (SPEC 15)
            accessibilityLabel={[
              plant.nickname,
              t.waterings(stats.waterings),
              stats.averageDays === null ? t.averageEmpty : t.average(stats.averageDays),
              t.current(stats.currentDays),
            ].join(', ')}
            onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id } })}
            style={styles.stats}>
            <View style={styles.statsTop}>
              <AppText variant="titleSm" numberOfLines={1} style={styles.fill}>
                {plant.nickname}
              </AppText>
              <AppText variant="caption">{t.waterings(stats.waterings)}</AppText>
            </View>
            <AppText>
              {stats.averageDays === null ? t.averageEmpty : t.average(stats.averageDays)}
            </AppText>
            <AppText variant="caption">{t.current(stats.currentDays)}</AppText>
            <AppText variant="caption">
              {stats.overdueCount === 0 ? t.overdueNone : t.overdue(stats.overdueCount)}
            </AppText>
          </Card>
        );
      }}
    />
  );
}

const Gap = () => <View style={styles.gap} />;

// 기록 탭 (SPEC 3.5): 날짜별 타임라인(식물로 거르기)과 식물별 통계. 사진 타임랩스는 2차.
export default function RecordsScreen() {
  const colors = useColors();
  const records = useRecords();
  const [view, setView] = useState<RecordsView>('date');
  const [plantId, setPlantId] = useState<string | null>(null);

  // 지운 식물을 고른 채로 남지 않게 한다
  const selected =
    plantId && records?.plants.some(({ plant }) => plant.id === plantId) ? plantId : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header" style={styles.title}>
        {ko.records.title}
      </AppText>

      <View style={styles.views}>
        <Chip label={ko.records.byDate} selected={view === 'date'} onPress={() => setView('date')} />
        <Chip label={ko.records.byPlant} selected={view === 'plant'} onPress={() => setView('plant')} />
      </View>

      {records === null ? null : view === 'date' ? (
        <Timeline
          records={records}
          plantId={selected}
          header={
            records.plants.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
                style={styles.filterRow}>
                <Chip label={ko.records.all} selected={selected === null} onPress={() => setPlantId(null)} />
                {records.plants.map(({ plant }) => (
                  <Chip
                    key={plant.id}
                    label={plant.nickname}
                    selected={selected === plant.id}
                    onPress={() => setPlantId(plant.id)}
                  />
                ))}
              </ScrollView>
            ) : null
          }
        />
      ) : (
        <Stats records={records} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: spacing.md,
  },
  title: {
    paddingHorizontal: spacing.xl - spacing.xs,
  },
  views: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingTop: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingTop: spacing.lg,
    // 우하단 + 버튼에 마지막 카드가 가리지 않게
    paddingBottom: spacing.xl * 4,
  },
  filters: {
    gap: spacing.sm,
  },
  filterRow: {
    marginBottom: spacing.md,
  },
  gap: {
    height: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  day: {
    gap: spacing.sm,
  },
  dayTitle: {
    marginHorizontal: spacing.xs,
  },
  rows: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  name: {
    width: 96,
  },
  fill: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  stats: {
    gap: spacing.xs,
  },
  statsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
