import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { deletePlant, updatePlant } from '@/db/plants';
import { computeInterval, toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { deletePhoto, photoUri } from '@/photos/photo-store';
import {
  feedbackStreak,
  needsSeasonQuestion,
  planKeepManual,
  planManualInterval,
} from '@/plants/care';
import { DaysLeft } from '@/plants/days-left';
import { formatInterval, formatMonthDay } from '@/plants/format';
import { classifyPlant, toEnginePlant } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { usePlantDetail } from '@/plants/use-plant-detail';
import { findSeedSpecies } from '@/species/seed';
import {
  AppText,
  Button,
  Card,
  Chevron,
  radius,
  SoilGauge,
  spacing,
  TextButton,
  useColors,
} from '@/ui';

/** 상세에 보여 주는 최근 물주기 건수 (SPEC 3.4 이력) */
const HISTORY_COUNT = 5;

type EditField = 'name' | 'interval' | 'repot' | 'move';

function InfoRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
      <AppText variant="formula" style={styles.infoLabel}>
        {label}
      </AppText>
      <AppText numberOfLines={1} style={styles.infoValue}>
        {value}
      </AppText>
      <Chevron />
    </Pressable>
  );
}

// 식물 상세 (SPEC 3.4). 계산식은 보여 주지 않고 언제, 며칠마다 주는지만 말한다.
// 관리 카드는 종 DB 가 붙는 3-4, 분재 작업 캘린더는 4-3 에서 채운다.
export default function PlantDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = usePlantDetail(id);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (detail === null || detail === 'missing') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
        <View style={styles.header}>
          <TextButton label={ko.common.goBack} onPress={close} />
        </View>
        {detail === 'missing' ? (
          <View style={styles.center}>
            <AppText>{ko.plantDetail.notFound}</AppText>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const { plant, space, waterings } = detail;
  const t = ko.plantDetail;
  const context = nowContext(detail.loadedAt);
  const soil = classifyPlant(plant, context.now, context.utcOffsetMinutes);
  const result = computeInterval(toEnginePlant(plant), space, context.season, context.coefficients);
  const species = plant.scientificName ? findSeedSpecies(plant.scientificName) : undefined;
  const streak = feedbackStreak(plant, waterings, context.coefficients);
  const history = waterings.slice(0, HISTORY_COUNT);
  const dateOf = (epochMs: number) =>
    formatMonthDay(toCalendarDate(epochMs, context.utcOffsetMinutes));

  const edit = (field: EditField) =>
    router.push({ pathname: '/sheet/plant-edit', params: { plantId: plant.id, field } });

  async function answerSeasonQuestion(keep: boolean) {
    const patch = keep
      ? planKeepManual(context)
      : planManualInterval(plant, space, null, context);
    await updatePlant(db, plant.id, patch);
    rescheduleSoon();
    // 이 화면과 목록이 다시 읽게 한다
    usePlantUi.getState().bumpGarden();
  }

  function confirmDelete() {
    Alert.alert(t.deleteTitle, t.deleteBody, [
      { text: ko.common.cancel, style: 'cancel' },
      {
        text: t.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          void deletePlant(db, plant.id).then((paths) => {
            paths.forEach(deletePhoto);
            rescheduleSoon();
            close();
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <TextButton label={ko.common.goBack} onPress={close} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {plant.coverPhotoPath ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="cover"
            source={{ uri: photoUri(plant.coverPhotoPath) }}
            style={[styles.photo, { backgroundColor: colors.soil.dry }]}
          />
        ) : null}

        <View style={styles.names}>
          <AppText variant="titleLg" accessibilityRole="header">
            {plant.nickname}
          </AppText>
          {species ? <AppText variant="scientific">{species.scientificName}</AppText> : null}
          <AppText variant="formula">
            {[species?.nameKo ?? ko.groupName[plant.groupCode], plant.isBonsai ? t.bonsai : null, space.name]
              .filter((part) => part !== null)
              .join(' · ')}
          </AppText>
        </View>

        <Card style={styles.stack}>
          <AppText variant="formula">{t.nextWater}</AppText>
          <View style={styles.nextRow}>
            <AppText variant="titleLg" style={styles.fill}>
              {dateOf(plant.nextWaterAt ?? plant.lastWateredAt)}
            </AppText>
            <DaysLeft daysLeft={soil.daysLeft} />
          </View>
          <SoilGauge
            variant={plant.isBonsai ? 'pot' : 'band'}
            status={soil.status}
            moisture={soil.moisture}
          />
          <AppText>{formatInterval(result)}</AppText>
          <AppText variant="formula">
            {plant.lastWateredUnknown ? t.lastWateredUnknown : t.lastWatered(dateOf(plant.lastWateredAt))}
          </AppText>
          <Button
            label={ko.action.watered}
            onPress={() =>
              router.push({ pathname: '/sheet/watered', params: { plantId: plant.id } })
            }
          />
        </Card>

        {needsSeasonQuestion(plant, context.season) && plant.manualInterval !== null ? (
          <Card style={styles.stack}>
            <AppText variant="titleSm">{t.seasonQuestion.title(ko.seasonMode[context.season])}</AppText>
            <AppText>{t.seasonQuestion.body(plant.manualInterval)}</AppText>
            <View style={styles.actions}>
              <Button
                label={t.seasonQuestion.auto}
                onPress={() => void answerSeasonQuestion(false)}
                style={styles.fill}
              />
              <Button
                label={t.seasonQuestion.keep}
                variant="secondary"
                onPress={() => void answerSeasonQuestion(true)}
                style={styles.fill}
              />
            </View>
          </Card>
        ) : null}

        {streak ? (
          <Card style={styles.stack}>
            <AppText>{t.streak[streak]}</AppText>
            <Button label={t.streak.action} variant="secondary" onPress={() => edit('interval')} />
          </Card>
        ) : null}

        <View style={styles.section}>
          <AppText variant="formula">{t.info}</AppText>
          <Card style={styles.rows}>
            <InfoRow label={t.space} value={space.name} onPress={() => edit('move')} />
            <View style={[styles.divider, { backgroundColor: colors.soil.dry }]} />
            <InfoRow
              label={t.pot}
              value={`${ko.potSize[plant.potSize]} · ${ko.soilType[plant.soilType]}`}
              onPress={() => edit('repot')}
            />
            <View style={[styles.divider, { backgroundColor: colors.soil.dry }]} />
            <InfoRow
              label={t.interval}
              value={
                plant.manualInterval === null
                  ? t.intervalAuto
                  : `${t.intervalManual} · ${ko.plantEdit.interval.days(plant.manualInterval)}`
              }
              onPress={() => edit('interval')}
            />
            <View style={[styles.divider, { backgroundColor: colors.soil.dry }]} />
            <InfoRow label={t.nickname} value={plant.nickname} onPress={() => edit('name')} />
          </Card>
          {plant.lastRepotAt ? (
            <AppText variant="formula">{t.repotted(dateOf(plant.lastRepotAt))}</AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <AppText variant="formula">{t.history}</AppText>
          {history.length === 0 ? (
            <AppText>{t.historyEmpty}</AppText>
          ) : (
            <Card style={styles.rows}>
              {history.map((log, index) => (
                <View key={log.id}>
                  {index > 0 ? (
                    <View style={[styles.divider, { backgroundColor: colors.soil.dry }]} />
                  ) : null}
                  <View style={styles.historyRow}>
                    <AppText style={styles.fill}>{dateOf(log.wateredAt)}</AppText>
                    <AppText variant="formula">{ko.records.soilState[log.soilState]}</AppText>
                  </View>
                </View>
              ))}
            </Card>
          )}
          {waterings.length > HISTORY_COUNT ? (
            <TextButton label={t.historyMore} onPress={() => router.navigate('/records')} />
          ) : null}
        </View>

        <Button label={t.delete} variant="secondary" onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingVertical: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingBottom: spacing.xl * 2,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
  },
  names: {
    gap: spacing.xs,
  },
  stack: {
    gap: spacing.md,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  rows: {
    paddingVertical: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infoLabel: {
    width: 56,
  },
  infoValue: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
