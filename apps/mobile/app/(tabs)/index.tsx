import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { updatePlant } from '@/db/plants';
import { canPostpone, toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { askPermissionOnce, NotificationBanner, rescheduleSoon } from '@/notifications';
import { formatMonthDay } from '@/plants/formula';
import { PlantCard } from '@/plants/plant-card';
import { SwipeRow } from '@/plants/swipe-row';
import { classifyToday, planPostpone } from '@/plants/today';
import type { TodayItem } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { useGarden } from '@/plants/use-plants';
import { AppText, Button, motion, spacing, useColors } from '@/ui';

function SectionTitle({ title, alert = false }: { title: string; alert?: boolean }) {
  const colors = useColors();

  return (
    <View style={styles.sectionTitle}>
      {/* 밀림은 빨간 점으로도 알린다 (SPEC 3.2). 글자가 같이 있어 색만으로 구분하지는 않는다 */}
      {alert ? <View style={[styles.dot, { backgroundColor: colors.warn }]} /> : null}
      <AppText variant="formula">{title}</AppText>
    </View>
  );
}

// 오늘 탭 (SPEC 3.2): 계절 배지, 밀림, 오늘, 다가옴, 오늘 물 준 식물.
// 경고 카드와 날씨 아이콘은 5주차, 분재 흙 확인 카드는 4-2 에서 채운다.
export default function TodayScreen() {
  const colors = useColors();
  const router = useRouter();
  const { garden, reload } = useGarden();
  const justWateredId = usePlantUi((state) => state.justWateredId);
  const clearWatered = usePlantUi((state) => state.clearWatered);

  // 번지는 모습은 한 번만 보여 준다. 끝나면 표시를 지워 다음에 다시 읽을 때 되풀이되지 않게 한다.
  useEffect(() => {
    if (!justWateredId) return;
    const timer = setTimeout(clearWatered, motion.soilGauge * 2);
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

  const openWatered = (item: TodayItem) =>
    router.push({ pathname: '/sheet/watered', params: { plantId: item.plant.id } });

  async function postpone(item: TodayItem) {
    const patch = planPostpone(item.plant, context);
    if (!patch) return;
    await updatePlant(db, item.plant.id, patch);
    // "내일로"는 알림도 하루 옮긴다 (SPEC 12.2 미룸)
    rescheduleSoon();
    reload();
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      {/* 14.5: 상단 큰 세리프로 오늘 날짜와 계절 모드 */}
      <View style={styles.header}>
        <View accessible accessibilityRole="header" accessibilityLabel={formatMonthDay(today)}>
          <AppText variant="formula">{ko.today.title}</AppText>
          <View style={styles.date}>
            <AppText variant="numeralSm">{today.month}</AppText>
            <AppText variant="titleSm">{ko.today.monthUnit}</AppText>
            <AppText variant="numeralSm"> {today.day}</AppText>
            <AppText variant="titleSm">{ko.today.dayUnit}</AppText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ko.seasonInfo.open}
          hitSlop={spacing.sm}
          onPress={() => router.push('/sheet/season')}
          style={[styles.badge, { borderColor: colors.ink }]}>
          <AppText variant="formula">{ko.seasonMode[context.season]}</AppText>
        </Pressable>
      </View>

      <NotificationBanner />

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
        <ScrollView contentContainerStyle={styles.list}>
          {sections.overdue.length > 0 ? <SectionTitle title={ko.today.overdue} alert /> : null}
          {sections.overdue.map((item) => (
            // 밀린 식물은 카드를 눌러 물 줬어요 시트로 간다. "내일로"는 없다 (SPEC 3.2)
            <PlantCard key={item.plant.id} {...item} onPress={() => openWatered(item)}>
              <Button label={ko.action.watered} onPress={() => openWatered(item)} />
            </PlantCard>
          ))}

          {sections.due.length > 0 ? <SectionTitle title={ko.today.due} /> : null}
          {sections.due.map((item) => {
            const postponable = canPostpone(item.plant.postponeCount, context.coefficients);
            return (
              <SwipeRow
                key={item.plant.id}
                onWatered={() => openWatered(item)}
                onPostpone={postponable ? () => void postpone(item) : undefined}>
                <PlantCard {...item}>
                  <View style={styles.actions}>
                    <Button
                      label={ko.action.watered}
                      onPress={() => openWatered(item)}
                      style={styles.fill}
                    />
                    <Button
                      label={ko.action.postpone}
                      variant="secondary"
                      disabled={!postponable}
                      onPress={() => void postpone(item)}
                      style={styles.fill}
                    />
                  </View>
                  {postponable ? null : <AppText variant="formula">{ko.today.postponeLimit}</AppText>}
                </PlantCard>
              </SwipeRow>
            );
          })}

          {sections.overdue.length + sections.due.length === 0 ? (
            <AppText>{ko.today.allClear}</AppText>
          ) : null}

          {sections.upcoming.length > 0 ? <SectionTitle title={ko.today.upcoming} /> : null}
          {sections.upcoming.map((item) => (
            <PlantCard key={item.plant.id} {...item} />
          ))}

          {sections.done.length > 0 ? <SectionTitle title={ko.today.done} /> : null}
          {sections.done.map((item) => (
            <PlantCard
              key={item.plant.id}
              {...item}
              done
              justWatered={item.plant.id === justWateredId}>
              {item.plant.nextWaterAt ? (
                <AppText variant="formula">
                  {ko.today.nextWater(
                    formatMonthDay(toCalendarDate(item.plant.nextWaterAt, context.utcOffsetMinutes)),
                  )}
                </AppText>
              ) : null}
            </PlantCard>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  date: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    // 우하단 + 버튼에 마지막 카드가 가리지 않게
    paddingBottom: spacing.xl * 4,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fill: {
    flex: 1,
  },
});
