import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { db } from '@/db/client';
import { insertEvent } from '@/db/events';
import { getPlantWithSpace } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import { recordWatering } from '@/db/watering';
import { SOIL_STATES } from '@/engine';
import type { SoilState } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { planWatering } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { AppText, Button, ChoiceCard, Notice, spacing } from '@/ui';

// 물 줬어요 시트 (SPEC 3.2): 흙 상태 3택(건너뛸 수 있다) + 잎이 처졌어요 + 완료.
// 수경은 흙 상태 대신 "물이 탁했어요" 하나만 묻는다 (5.5).
export default function WateredSheet() {
  const router = useRouter();
  const { plantId } = useLocalSearchParams<{ plantId: string }>();
  const markWatered = usePlantUi((state) => state.markWatered);
  const [target, setTarget] = useState<PlantWithSpace | null>(null);
  const [soilState, setSoilState] = useState<SoilState | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getPlantWithSpace(db, plantId).then(setTarget);
  }, [plantId]);

  if (!target) {
    return <View style={styles.loading} />;
  }

  const { plant, space } = target;
  const hydro = plant.soilType === 'hydro';

  async function finish() {
    setBusy(true);
    setFailed(false);
    try {
      const plan = planWatering(
        plant,
        space,
        // 흙 상태를 고르지 않으면 건너뛴 것으로 기록하고 U 는 그대로 둔다
        { soilState: soilState ?? 'skipped', leafDroop: !hydro && checked },
        { ...nowContext(), logId: randomUUID() },
      );
      await recordWatering(db, plant.id, plan.plantPatch, plan.log);
      if (hydro && checked) {
        await insertEvent(db, {
          id: randomUUID(),
          plantId: plant.id,
          type: 'note',
          occurredAt: plan.log.wateredAt,
          payload: { kind: 'water_cloudy' },
        });
      }
      markWatered(plant.id);
      rescheduleSoon();
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <View style={styles.sheet}>
      <AppText variant="titleSm" accessibilityRole="header">
        {hydro ? ko.wateredSheet.hydroTitle(plant.nickname) : ko.wateredSheet.title(plant.nickname)}
      </AppText>

      {hydro ? null : (
        <View accessibilityRole="radiogroup" style={styles.stack}>
          <AppText>{ko.wateredSheet.soilQuestion}</AppText>
          <AppText variant="formula">{ko.wateredSheet.soilGuide}</AppText>
          {SOIL_STATES.map((state) => (
            <ChoiceCard
              key={state}
              label={ko.wateredSheet.soilState[state]}
              hint={ko.wateredSheet.soilStateHint[state]}
              selected={soilState === state}
              // 다시 누르면 고른 것을 푼다
              onPress={() => setSoilState(soilState === state ? null : state)}
            />
          ))}
        </View>
      )}

      <ChoiceCard
        label={hydro ? ko.wateredSheet.waterCloudy : ko.wateredSheet.leafDroop}
        selected={checked}
        onPress={() => setChecked((value) => !value)}
      />

      {failed ? <Notice message={ko.wateredSheet.failed} /> : null}
      <Button label={ko.action.done} disabled={busy} onPress={() => void finish()} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 시트 높이를 내용에 맞추므로 flex: 1 을 쓰지 않는다
  sheet: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    // 하단 안전 영역은 시트가 알아서 띄운다
    paddingBottom: spacing.xl,
  },
  stack: {
    gap: spacing.md,
  },
  loading: {
    height: 320,
  },
});
