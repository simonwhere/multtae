import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { db } from '@/db/client';
import { insertEvent } from '@/db/events';
import { getPlantWithSpace, updatePlant } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import { recordWatering } from '@/db/watering';
import { applyFeedback, SOIL_STATES } from '@/engine';
import type { SoilState } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { isFertilizerDueToday } from '@/plants/feeding-db';
import { planPostpone, planWatering } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { AppText, Button, ChoiceCard, Notice, spacing } from '@/ui';

// 물 줬어요 시트 (SPEC 3.2): 흙 상태 3택(건너뛸 수 있다) + 잎이 처졌어요 + 완료.
// 수경은 흙 상태 대신 "물이 탁했어요" 하나만 묻는다 (5.5). 비료 차례인 날에는 "비료도 줬어요"를 묻는다 (8.2).
export default function WateredSheet() {
  const router = useRouter();
  const { plantId } = useLocalSearchParams<{ plantId: string }>();
  const markWatered = usePlantUi((state) => state.markWatered);
  const [target, setTarget] = useState<PlantWithSpace | null>(null);
  const [soilState, setSoilState] = useState<SoilState | null>(null);
  const [checked, setChecked] = useState(false);
  /** 오늘 비료 차례면 true. 사용자가 고르면 fertilized 로 기록한다 (SPEC 8.2) */
  const [fertilizerDue, setFertilizerDue] = useState(false);
  const [fertilized, setFertilized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getPlantWithSpace(db, plantId).then(async (item) => {
      setTarget(item);
      if (item) setFertilizerDue(await isFertilizerDueToday(db, item.plant, nowContext()));
    });
  }, [plantId]);

  if (!target) {
    return <View style={styles.loading} />;
  }

  const { plant, space } = target;
  const hydro = plant.soilType === 'hydro';
  const bonsai = plant.isBonsai && !hydro;

  /** 분재의 "아직 촉촉해요": 물을 주지 않고 내일 다시 본다. 촉촉 응답이 주기를 늘린다 (SPEC 6.1) */
  async function postponeMoist() {
    setBusy(true);
    setFailed(false);
    try {
      const context = nowContext();
      const learned = applyFeedback(plant.learnFactor, 'wet', false, context.coefficients);
      // 세 번을 넘겨 미룰 수 없으면 날짜는 그대로 두고 배운 값만 올린다. 그러면 내일 밀림으로 나온다
      const patch = planPostpone(plant, context);
      await updatePlant(db, plant.id, { ...(patch ?? {}), learnFactor: learned });
      rescheduleSoon();
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setFailed(false);
    try {
      const plan = planWatering(
        plant,
        space,
        // 흙 상태를 고르지 않으면 건너뛴 것으로 기록하고 U 는 그대로 둔다
        { soilState: bonsai ? 'dry' : (soilState ?? 'skipped'), leafDroop: !hydro && !bonsai && checked },
        { ...nowContext(), logId: randomUUID() },
      );
      await recordWatering(db, plant.id, plan.plantPatch, plan.log);
      if (fertilizerDue && fertilized) {
        await insertEvent(db, {
          id: randomUUID(),
          plantId: plant.id,
          type: 'fertilize',
          occurredAt: plan.log.wateredAt,
        });
      }
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

  const fertilizerChoice = (
    <ChoiceCard
      label={ko.wateredSheet.fertilize}
      hint={ko.wateredSheet.fertilizeHint}
      selected={fertilized}
      onPress={() => setFertilized((value) => !value)}
    />
  );

  return (
    <View style={styles.sheet}>
      <AppText variant="titleSm" accessibilityRole="header">
        {hydro
          ? ko.wateredSheet.hydroTitle(plant.nickname)
          : bonsai
            ? ko.wateredSheet.bonsaiTitle(plant.nickname)
            : ko.wateredSheet.title(plant.nickname)}
      </AppText>

      {fertilizerDue && bonsai ? fertilizerChoice : null}

      {bonsai ? (
        <View style={styles.stack}>
          <Button label={ko.wateredSheet.bonsaiDry} disabled={busy} onPress={() => void finish()} />
          <Button
            label={ko.wateredSheet.bonsaiMoist}
            variant="secondary"
            disabled={busy}
            onPress={() => void postponeMoist()}
          />
          <AppText variant="caption">{ko.wateredSheet.bonsaiDryHint}</AppText>
          <AppText variant="caption">{ko.wateredSheet.bonsaiMoistHint}</AppText>
        </View>
      ) : null}

      {hydro || bonsai ? null : (
        <View accessibilityRole="radiogroup" style={styles.stack}>
          <AppText>{ko.wateredSheet.soilQuestion}</AppText>
          <AppText variant="caption">{ko.wateredSheet.soilGuide}</AppText>
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

      {bonsai ? null : (
        <ChoiceCard
          label={hydro ? ko.wateredSheet.waterCloudy : ko.wateredSheet.leafDroop}
          selected={checked}
          onPress={() => setChecked((value) => !value)}
        />
      )}

      {/* 분재는 말랐어요를 누르면 바로 끝나므로 비료는 그 위에서 묻는다 */}
      {fertilizerDue && !bonsai ? fertilizerChoice : null}

      {failed ? <Notice message={ko.wateredSheet.failed} /> : null}
      {bonsai ? null : (
        <Button label={ko.action.done} disabled={busy} onPress={() => void finish()} />
      )}
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
