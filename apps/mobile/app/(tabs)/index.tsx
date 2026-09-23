import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { updatePlant } from '@/db/plants';
import { canPostpone, toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { askPermissionOnce, NotificationBanner, rescheduleSoon } from '@/notifications';
import { formatDottedDate, formatMonthDay, formatWeekday } from '@/plants/format';
import { PlantCard } from '@/plants/plant-card';
import { SwipeRow } from '@/plants/swipe-row';
import { classifyToday, planPostpone } from '@/plants/today';
import { winterWarnings } from '@/plants/winter';
import { repotHints } from '@/plants/feeding-db';
import type { RepotHint } from '@/plants/feeding';
import type { Plant } from '@/db/schema';
import { cardText, repotCardTexts, winterCardText } from '@/weather/card-text';
import { dismissCard, loadDismissed } from '@/weather/dismissed';
import { dateKey, dayOf, isWeatherUsable } from '@/weather/forecast';
import { weatherCards } from '@/weather/rules';
import { useWeatherState } from '@/weather/store';
import { WarningCard } from '@/weather/warning-card';
import { WeatherIcon } from '@/weather/weather-icon';
import type { TodayItem, TodaySections } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { useGarden } from '@/plants/use-plants';
import { AppText, Button, motion, radius, spacing, Sprig, TabIcon, useColors } from '@/ui';

function SectionTitle({ title }: { title: string }) {
  return (
    <AppText variant="label" accessibilityRole="header" style={styles.sectionTitle}>
      {title}
    </AppText>
  );
}

/** 밀림·오늘·다가옴이 몇 개인지. 점의 색과 함께 글자로도 말한다 (SPEC 3.2, 15) */
function CountChip({ label, count, dot }: { label: string; count: number; dot: string }) {
  const colors = useColors();

  return (
    <View
      accessible
      accessibilityLabel={`${label} ${count}`}
      style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
      <View style={styles.chipLabel}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <AppText variant="caption">{label}</AppText>
      </View>
      <AppText variant="numeralSm">{count}</AppText>
    </View>
  );
}

/** 목록 한 줄. 식물이 많아도 보이는 만큼만 그리려고 구역 제목과 카드를 한 줄로 편다 (SPEC 15 성능) */
type Row =
  | { kind: 'title'; key: string; title: string }
  | { kind: 'allClear'; key: string }
  | { kind: 'overdue' | 'due' | 'upcoming' | 'done'; key: string; item: TodayItem };

function rowsOf(sections: TodaySections): Row[] {
  const rows: Row[] = [];
  const section = (
    kind: 'overdue' | 'due' | 'upcoming' | 'done',
    title: string,
    items: TodayItem[],
  ) => {
    if (items.length === 0) return;
    rows.push({ kind: 'title', key: `title-${kind}`, title });
    for (const item of items) rows.push({ kind, key: item.plant.id, item });
  };

  section('overdue', ko.today.overdue, sections.overdue);
  section('due', ko.today.due, sections.due);
  if (sections.overdue.length + sections.due.length === 0) {
    rows.push({ kind: 'allClear', key: 'all-clear' });
  }
  section('upcoming', ko.today.upcoming, sections.upcoming);
  section('done', ko.today.done, sections.done);
  return rows;
}

// 오늘 탭 (SPEC 3.2): 날짜와 계절 이름표, 날씨, 경고 카드, 개수, 밀림, 오늘, 다가옴, 오늘 물 준 식물.
export default function TodayScreen() {
  const colors = useColors();
  const router = useRouter();
  const { garden, reload } = useGarden();
  const justWateredId = usePlantUi((state) => state.justWateredId);
  const clearWatered = usePlantUi((state) => state.clearWatered);

  // 게이지가 차는 모습은 한 번만 보여 준다. 끝나면 표시를 지워 다음에 다시 읽을 때 되풀이되지 않게 한다.
  useEffect(() => {
    if (!justWateredId) return;
    const timer = setTimeout(clearWatered, motion.gauge * 2);
    return () => clearTimeout(timer);
  }, [justWateredId, clearWatered]);

  // 알림 권한은 식물이 생긴 뒤에 묻는다. 첫 식물을 저장하고 돌아온 이 화면에서 시스템 창이 뜬다
  const hasPlants = (garden?.plants.length ?? 0) > 0;
  useEffect(() => {
    if (hasPlants) void askPermissionOnce();
  }, [hasPlants]);

  const context = nowContext(garden?.loadedAt);
  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  const sections = garden
    ? classifyToday(garden.plants, context.now, context.utcOffsetMinutes)
    : null;

  // 날씨는 48시간 안에 받은 것만 쓴다 (7.1). 못 쓰면 계절 카드만 뜬다
  const storedWeather = useWeatherState((state) => state.weather);
  const weather = isWeatherUsable(storedWeather, context.now, context.utcOffsetMinutes)
    ? storedWeather
    : null;
  const todayWeather = dayOf(weather, today);

  // 닫은 카드는 그날 다시 띄우지 않는다 (3.2)
  const todayKey = dateKey(today);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      void loadDismissed(db, todayKey).then(setDismissed);
    }, [todayKey]),
  );
  // 분갈이 검토 (8.3). 종 정보와 최근 흙 상태를 읽어야 해서 따로 불러온다
  const [repots, setRepots] = useState<{ plant: Plant; hint: RepotHint }[]>([]);
  useEffect(() => {
    if (!garden) return;
    const { now, utcOffsetMinutes } = nowContext(garden.loadedAt);
    void repotHints(db, garden.plants, { now, utcOffsetMinutes }).then(setRepots);
  }, [garden]);

  const cards = garden
    ? [
        ...weatherCards(garden.plants, weather, context).map(cardText),
        ...winterWarnings(garden.plants, context.season).map(winterCardText),
        ...repotCardTexts(repots),
      ].filter((card) => !dismissed.includes(card.key))
    : [];

  const openWatered = (item: TodayItem) =>
    router.push({ pathname: '/sheet/watered', params: { plantId: item.plant.id } });
  const openDetail = (item: TodayItem) =>
    router.push({ pathname: '/plant/[id]', params: { id: item.plant.id } });

  async function postpone(item: TodayItem) {
    const patch = planPostpone(item.plant, context);
    if (!patch) return;
    await updatePlant(db, item.plant.id, patch);
    // "내일로"는 알림도 하루 옮긴다 (SPEC 12.2 미룸)
    rescheduleSoon();
    reload();
  }

  const rows = useMemo(() => (sections ? rowsOf(sections) : []), [sections]);
  const empty = garden !== null && (garden.spaces.length === 0 || garden.plants.length === 0);

  const header = (
    <View style={styles.listHeader}>
        {/* 14.5: 이름표처럼 요일과 계절, 큰 날짜, 구석의 잔가지 */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.headerTop}>
              <AppText variant="label" color={colors.sub}>
                {formatWeekday(today)}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ko.seasonInfo.open}
                hitSlop={spacing.sm}
                onPress={() => router.push('/sheet/season')}
                style={[styles.season, { backgroundColor: colors.highlight }]}>
                {/* 이름표를 끈에 꿰는 구멍 */}
                <View style={[styles.hole, { backgroundColor: colors.paper }]} />
                <AppText variant="tag">{ko.seasonMode[context.season]}</AppText>
              </Pressable>
              {/* 오늘 날씨 (3.2). 지역을 고르고 예보를 받았을 때만 */}
              {todayWeather?.condition && todayWeather.tmax !== null ? (
                <View
                  accessible
                  accessibilityLabel={ko.weather.summary(
                    ko.weather.condition[todayWeather.condition],
                    Math.round(todayWeather.tmax),
                    Math.round(todayWeather.tmin ?? todayWeather.tmax),
                  )}
                  style={styles.weather}>
                  <WeatherIcon condition={todayWeather.condition} color={colors.sub} />
                  <AppText variant="label" color={colors.sub}>
                    {ko.weather.high(Math.round(todayWeather.tmax))}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText
              variant="numeralLg"
              accessibilityRole="header"
              accessibilityLabel={formatMonthDay(today)}>
              {formatDottedDate(today)}
            </AppText>
          </View>
          <View style={styles.corner}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ko.settings.open}
              hitSlop={spacing.sm}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.settings, pressed && styles.pressed]}>
              <TabIcon name="settings" color={colors.sub} />
            </Pressable>
            <Sprig />
          </View>
        </View>

        <NotificationBanner />

        {/* 경고 카드: 날씨(7.2), 분재 월동(6.3), 난방 습도(7.3), 장마 시작(7.4), 분갈이 검토(8.3) */}
        {cards.map((card) => (
          <WarningCard
            key={card.key}
            card={card}
            onClose={() => void dismissCard(db, todayKey, card.key).then(setDismissed)}
          />
        ))}
      {sections === null || garden === null ? null : garden.spaces.length === 0 ? (
        // 공간을 먼저 등록하고 식물을 놓는다 (SPEC 1)
        <View style={styles.empty}>
          <AppText>{ko.today.empty}</AppText>
          <Button label={ko.today.registerSpace} onPress={() => router.push('/register/space')} />
        </View>
      ) : garden.plants.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.today.noPlants}</AppText>
          <Button label={ko.today.registerPlant} onPress={() => router.push('/register/plant')} />
        </View>
      ) : (
        <View style={styles.chips}>
          <CountChip label={ko.today.overdue} count={sections.overdue.length} dot={colors.berry} />
          <CountChip label={ko.today.title} count={sections.due.length} dot={colors.accent} />
          <CountChip label={ko.today.upcoming} count={sections.upcoming.length} dot={colors.sprig} />
        </View>
      )}
    </View>
  );

  function renderRow(row: Row) {
    if (row.kind === 'title') return <SectionTitle title={row.title} />;
    if (row.kind === 'allClear') return <AppText style={styles.allClear}>{ko.today.allClear}</AppText>;

    const item = row.item;
    if (row.kind === 'overdue') {
      // 밀린 식물은 카드를 눌러도 물 줬어요 시트로 간다. "내일로"는 없다 (SPEC 3.2)
      return (
        <PlantCard {...item} onPress={() => openWatered(item)}>
          <Button label={ko.action.watered} onPress={() => openWatered(item)} />
        </PlantCard>
      );
    }
    if (row.kind === 'due') {
      const postponable = canPostpone(item.plant.postponeCount, context.coefficients);
      return (
        <SwipeRow
          onWatered={() => openWatered(item)}
          onPostpone={postponable ? () => void postpone(item) : undefined}>
          <PlantCard {...item} highlighted>
            <View style={styles.actions}>
              <Button
                label={ko.action.watered}
                onPress={() => openWatered(item)}
                style={styles.fill}
              />
              <Button
                label={ko.action.postpone}
                variant="surface"
                disabled={!postponable}
                onPress={() => void postpone(item)}
                style={styles.fill}
              />
            </View>
            {postponable ? null : <AppText variant="caption">{ko.today.postponeLimit}</AppText>}
          </PlantCard>
        </SwipeRow>
      );
    }
    if (row.kind === 'upcoming') {
      return <PlantCard {...item} onPress={() => openDetail(item)} />;
    }
    return (
      <PlantCard
        {...item}
        done
        justWatered={item.plant.id === justWateredId}
        note={
          item.plant.nextWaterAt
            ? ko.today.nextWater(
                formatMonthDay(toCalendarDate(item.plant.nextWaterAt, context.utcOffsetMinutes)),
              )
            : undefined
        }
        onPress={() => openDetail(item)}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) => renderRow(row)}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={[styles.list, empty && styles.listGrow]}
        initialNumToRender={6}
      />
    </SafeAreaView>
  );
}

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingTop: spacing.md,
    // 우하단 + 버튼에 마지막 카드가 가리지 않게
    paddingBottom: spacing.xl * 4,
  },
  listGrow: {
    flexGrow: 1,
  },
  // 헤더 안에서는 예전처럼 사이를 띄운다
  listHeader: {
    gap: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
  },
  gap: {
    height: spacing.sm + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: spacing.sm,
  },
  // 오른쪽 위는 설정, 아래는 잔가지
  corner: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  settings: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
    marginTop: -spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  season: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
    borderRadius: radius.tag + 1,
    paddingLeft: spacing.sm + 1,
    paddingRight: spacing.md,
  },
  hole: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    flex: 1,
    gap: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  chipLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
  },
  allClear: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fill: {
    flex: 1,
  },
});
