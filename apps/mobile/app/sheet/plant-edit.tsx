import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { insertEvent } from '@/db/events';
import { getPlantWithSpace, updatePlant } from '@/db/plants';
import type { PlantPatch, PlantWithSpace } from '@/db/plants';
import type { NewPlantEvent, Space } from '@/db/schema';
import { listSpaces } from '@/db/spaces';
import { computeInterval, POT_SIZES, SOIL_TYPES } from '@/engine';
import type { PotSize, SoilType } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import {
  MAX_MANUAL_DAYS,
  MIN_MANUAL_DAYS,
  planManualInterval,
  planMove,
  planRename,
  planRepot,
} from '@/plants/care';
import { MAX_NICKNAME_LENGTH } from '@/plants/registration';
import { toEnginePlant } from '@/plants/today';
import { nowContext } from '@/plants/use-now';
import { AppText, Button, ChoiceCard, spacing, TextField } from '@/ui';

type Field = 'name' | 'interval' | 'repot' | 'move';

interface Change {
  patch: PlantPatch;
  event?: NewPlantEvent;
}

// 식물 상세의 편집 시트 (SPEC 3.4 편집): 별명, 물주기 직접 정하기, 분갈이, 공간 이동.
// 저장하면 바로 다시 세고 알림도 다시 예약한다 (5.5).
// 공간 이동만 목록이 길어질 수 있어 스크롤되는 모달로 뜬다 (app/_layout.tsx).
export default function PlantEditSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plantId, field } = useLocalSearchParams<{ plantId: string; field: Field }>();
  const [target, setTarget] = useState<PlantWithSpace | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [nickname, setNickname] = useState('');
  const [manualDays, setManualDays] = useState<number | null>(null);
  const [potSize, setPotSize] = useState<PotSize>('m');
  const [soilType, setSoilType] = useState<SoilType>('potting');
  const [spaceId, setSpaceId] = useState('');

  useEffect(() => {
    void Promise.all([getPlantWithSpace(db, plantId), listSpaces(db)]).then(([item, all]) => {
      if (!item) return;
      setTarget(item);
      setSpaces(all);
      setNickname(item.plant.nickname);
      setManualDays(item.plant.manualInterval);
      setPotSize(item.plant.potSize);
      setSoilType(item.plant.soilType);
      setSpaceId(item.plant.spaceId);
    });
  }, [plantId]);

  if (!target) return <View style={styles.sheet} />;

  const { plant, space } = target;
  const t = ko.plantEdit;
  const context = nowContext();
  // 자동일 때의 주기. 직접 정하기를 고르면 여기서부터 늘리고 줄인다
  const autoDays = computeInterval(
    { ...toEnginePlant(plant), manualInterval: null },
    space,
    context.season,
    context.coefficients,
  ).days;

  function change(): Change | null {
    switch (field) {
      case 'name': {
        const renamed = planRename(nickname);
        return renamed === null ? null : { patch: { nickname: renamed } };
      }
      case 'interval':
        return { patch: planManualInterval(plant, space, manualDays, context) };
      case 'repot': {
        const plan = planRepot(plant, space, { potSize, soilType }, { ...context, eventId: randomUUID() });
        return potSize === plant.potSize && soilType === plant.soilType ? { patch: {} } : plan;
      }
      case 'move': {
        const destination = spaces.find((candidate) => candidate.id === spaceId);
        const plan = destination
          ? planMove(plant, destination, { ...context, eventId: randomUUID() })
          : null;
        return plan ?? { patch: {} };
      }
    }
  }

  // 별명만 비어 있을 수 있다. 나머지는 고른 값이 늘 있다
  const canSave = field !== 'name' || planRename(nickname) !== null;

  async function save() {
    const pending = change();
    if (!pending) return;
    setBusy(true);
    setFailed(false);
    try {
      if (Object.keys(pending.patch).length > 0) {
        await updatePlant(db, plant.id, pending.patch);
        if (pending.event) await insertEvent(db, pending.event);
        rescheduleSoon();
      }
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <View
      style={
        field === 'move'
          ? [styles.sheet, styles.fill, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]
          : styles.sheet
      }>
      {field === 'name' ? (
        <>
          <AppText variant="titleSm" accessibilityRole="header">
            {t.rename.title}
          </AppText>
          <TextField
            autoFocus
            label={t.rename.label}
            maxLength={MAX_NICKNAME_LENGTH}
            returnKeyType="done"
            value={nickname}
            onChangeText={setNickname}
            onSubmitEditing={() => void save()}
          />
        </>
      ) : null}

      {field === 'interval' ? (
        <>
          <AppText variant="titleSm" accessibilityRole="header">
            {t.interval.title}
          </AppText>
          <ChoiceCard
            label={t.interval.auto(t.interval.days(autoDays))}
            hint={t.interval.autoHint}
            selected={manualDays === null}
            onPress={() => setManualDays(null)}
          />
          <ChoiceCard
            label={t.interval.manual}
            hint={t.interval.manualHint}
            selected={manualDays !== null}
            onPress={() => setManualDays(manualDays ?? plant.manualInterval ?? autoDays)}
          />
          {manualDays !== null ? (
            <View style={styles.stepper}>
              <Button
                label={t.interval.fewer}
                variant="secondary"
                disabled={manualDays <= MIN_MANUAL_DAYS}
                onPress={() => setManualDays(manualDays - 1)}
              />
              <AppText variant="titleSm" style={styles.stepperValue}>
                {t.interval.days(manualDays)}
              </AppText>
              <Button
                label={t.interval.more}
                variant="secondary"
                disabled={manualDays >= MAX_MANUAL_DAYS}
                onPress={() => setManualDays(manualDays + 1)}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {field === 'repot' ? (
        <>
          <AppText variant="titleSm" accessibilityRole="header">
            {t.repot.title}
          </AppText>
          <AppText variant="caption">{t.repot.guide}</AppText>
          <AppText variant="caption">{t.repot.pot}</AppText>
          <View style={styles.row}>
            {POT_SIZES.map((size) => (
              <ChoiceCard
                key={size}
                centered
                label={ko.potSize[size]}
                selected={potSize === size}
                onPress={() => setPotSize(size)}
                style={styles.fill}
              />
            ))}
          </View>
          <AppText variant="caption">{t.repot.soil}</AppText>
          <View style={styles.grid}>
            {SOIL_TYPES.map((soil) => (
              <ChoiceCard
                key={soil}
                centered
                label={ko.soilType[soil]}
                selected={soilType === soil}
                onPress={() => setSoilType(soil)}
                style={styles.half}
              />
            ))}
          </View>
        </>
      ) : null}

      {field === 'move' ? (
        <>
          <AppText variant="titleSm" accessibilityRole="header">
            {t.move.title}
          </AppText>
          <AppText variant="caption">{t.move.guide}</AppText>
          <ScrollView style={styles.fill} contentContainerStyle={styles.list}>
            {spaces.map((candidate) => (
              <ChoiceCard
                key={candidate.id}
                label={candidate.name}
                hint={ko.lightGrade[candidate.lightGrade]}
                selected={spaceId === candidate.id}
                onPress={() => setSpaceId(candidate.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {failed ? <AppText>{t.saveFailed}</AppText> : null}
      <Button label={ko.common.save} disabled={busy || !canSave} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    // 하단 안전 영역은 시트가 알아서 띄운다
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fill: {
    flex: 1,
  },
  half: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  list: {
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
  },
});
