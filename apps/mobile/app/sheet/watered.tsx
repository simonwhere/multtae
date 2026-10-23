import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Image } from 'expo-image';

import { db } from '@/db/client';
import { insertEvent } from '@/db/events';
import { addPlantPhoto } from '@/db/photos';
import { getPlantWithSpace, updatePlant } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import { recordWatering, undoWatering, updateWateringLog } from '@/db/watering';
import { applyFeedback, isDroopWarning, SOIL_STATES } from '@/engine';
import type { SoilState } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { isFertilizerDueToday } from '@/plants/feeding-db';
import { deletePhoto, photoUri, pickPhoto } from '@/photos/photo-store';
import type { PhotoSource } from '@/photos/photo-store';
import { planFeedback, planPostpone, planWatering, wateringUndoPatch } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { AppText, Button, ChoiceCard, Notice, radius, showAlert, spacing, TextButton, useColors } from '@/ui';

/**
 * 물 줬어요 시트 (SPEC 3.2, 10-2). 일반 식물과 수경은 시트가 열리는 순간 물을 줬다고 기록한다.
 * 흙 상태 3택(건너뛸 수 있다)과 잎이 처졌어요, 사진, 비료는 그 기록에 덧붙이는 것이라
 * 시트를 그냥 내려도 기록은 남고, "안 줬어요"로만 물린다.
 * 분재는 물을 줄지 흙을 보고 정하므로 먼저 묻는다: 말랐어요(기록) / 아직 촉촉해요(내일 다시) (6.1).
 * 수경은 흙 상태 대신 "물이 탁했어요" 하나만 묻는다 (5.5). 비료 차례인 날에는 "비료도 줬어요"를 묻는다 (8.2).
 */
export default function WateredSheet() {
  const colors = useColors();
  const router = useRouter();
  const { plantId } = useLocalSearchParams<{ plantId: string }>();
  const markWatered = usePlantUi((state) => state.markWatered);
  const clearWatered = usePlantUi((state) => state.clearWatered);
  const [target, setTarget] = useState<PlantWithSpace | null>(null);
  const [soilState, setSoilState] = useState<SoilState | null>(null);
  const [checked, setChecked] = useState(false);
  /** 오늘 비료 차례면 true. 사용자가 고르면 fertilized 로 기록한다 (SPEC 8.2) */
  const [fertilizerDue, setFertilizerDue] = useState(false);
  const [fertilized, setFertilized] = useState(false);
  /** 오늘 모습을 남기는 사진 (SPEC 8.4). 완료할 때 함께 저장한다 */
  const [photo, setPhoto] = useState<{ path: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /** 시트를 열며 남긴 기록. 분재이거나 기록에 실패했으면 null */
  const [logId, setLogId] = useState<string | null>(null);
  const before = useRef<ReturnType<typeof wateringUndoPatch> | null>(null);
  const recorded = useRef(false);

  useEffect(() => {
    void getPlantWithSpace(db, plantId).then(async (item) => {
      if (!item) {
        setTarget(null);
        return;
      }
      setFertilizerDue(await isFertilizerDueToday(db, item.plant, nowContext()));

      const bonsai = item.plant.isBonsai && item.plant.soilType !== 'hydro';
      if (bonsai || recorded.current) {
        setTarget(item);
        return;
      }
      // 일반 식물은 열리는 순간 기록한다. 흙 상태는 아직 모르므로 건너뜀으로 두고 완료할 때 덧붙인다
      recorded.current = true;
      try {
        const plan = planWatering(
          item.plant,
          item.space,
          { soilState: 'skipped', leafDroop: false },
          { ...nowContext(), logId: randomUUID() },
        );
        before.current = wateringUndoPatch(item.plant);
        await recordWatering(db, item.plant.id, plan.plantPatch, plan.log);
        setLogId(plan.log.id);
        setTarget({ ...item, plant: { ...item.plant, ...plan.plantPatch } });
        markWatered(item.plant.id);
        rescheduleSoon();
      } catch {
        setFailed(true);
        setTarget(item);
      }
    });
  }, [plantId, markWatered]);

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

  /** 사진·비료·탁한 물은 기록에 딸린 것이라 끝날 때 한 번에 남긴다 */
  async function saveExtras(wateredAt: number) {
    if (photo) {
      // 식물당 최근 100장만 남기고 넘치는 파일은 지운다 (8.4)
      const pruned = await addPlantPhoto(db, {
        id: randomUUID(),
        plantId: plant.id,
        path: photo.path,
        takenAt: wateredAt,
        width: photo.width,
        height: photo.height,
      });
      pruned.forEach(deletePhoto);
    }
    if (fertilizerDue && fertilized) {
      await insertEvent(db, { id: randomUUID(), plantId: plant.id, type: 'fertilize', occurredAt: wateredAt });
    }
    if (hydro && checked) {
      await insertEvent(db, {
        id: randomUUID(),
        plantId: plant.id,
        type: 'note',
        occurredAt: wateredAt,
        payload: { kind: 'water_cloudy' },
      });
    }
  }

  async function finish() {
    setBusy(true);
    setFailed(false);
    try {
      const context = nowContext();
      const input = {
        // 흙 상태를 고르지 않으면 건너뛴 것으로 기록하고 U 는 그대로 둔다
        soilState: bonsai ? ('dry' as const) : (soilState ?? ('skipped' as const)),
        leafDroop: !hydro && !bonsai && checked,
      };
      if (logId) {
        // 열 때 남긴 기록에 흙 상태를 덧붙이고 다음 물주기를 다시 센다
        const plan = planFeedback(plant, space, input, context);
        await updateWateringLog(db, logId, plan.logPatch);
        await updatePlant(db, plant.id, plan.plantPatch);
        await saveExtras(context.now);
      } else {
        // 분재이거나 열 때 기록하지 못했으면 지금 기록한다
        const plan = planWatering(plant, space, input, { ...context, logId: randomUUID() });
        await recordWatering(db, plant.id, plan.plantPatch, plan.log);
        await saveExtras(plan.log.wateredAt);
        markWatered(plant.id);
      }
      rescheduleSoon();
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  /** "안 줬어요": 열 때 남긴 기록을 지우고 식물을 되돌린다 */
  async function notWatered() {
    if (!logId || !before.current) {
      router.back();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await undoWatering(db, logId, plant.id, before.current);
      if (photo) deletePhoto(photo.path);
      clearWatered();
      rescheduleSoon();
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  async function addPhoto(source: PhotoSource) {
    if (!target || busy) return;
    const result = await pickPhoto(source, 'plants', target.plant.id);
    if (result.status !== 'picked') return;
    if (photo) deletePhoto(photo.path);
    setPhoto(result.photo);
  }

  function chooseSource() {
    showAlert(ko.wateredSheet.addPhoto, undefined, [
      { text: ko.spaceDetail.retakeCamera, onPress: () => void addPhoto('camera') },
      { text: ko.spaceDetail.retakeLibrary, onPress: () => void addPhoto('library') },
      { text: ko.common.cancel, style: 'cancel' },
    ]);
  }

  function removePhoto() {
    if (photo) deletePhoto(photo.path);
    setPhoto(null);
  }

  const photoChoice = photo ? (
    <View style={styles.photoRow}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={ko.wateredSheet.photoAdded}
        contentFit="cover"
        source={{ uri: photoUri(photo.path) }}
        style={[styles.photo, { backgroundColor: colors.block }]}
      />
      <AppText style={styles.fill}>{ko.wateredSheet.photoAdded}</AppText>
      <TextButton label={ko.wateredSheet.removePhoto} onPress={removePhoto} />
    </View>
  ) : (
    <Button
      label={ko.wateredSheet.addPhoto}
      variant="surface"
      disabled={busy}
      onPress={chooseSource}
    />
  );

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
      <View style={styles.titleRow}>
        <AppText variant="titleSm" accessibilityRole="header" style={styles.fill}>
          {hydro
            ? ko.wateredSheet.hydroTitle(plant.nickname)
            : bonsai
              ? ko.wateredSheet.bonsaiTitle(plant.nickname)
              : ko.wateredSheet.title(plant.nickname)}
        </AppText>
        {logId ? <TextButton label={ko.wateredSheet.notWatered} onPress={() => void notWatered()} /> : null}
      </View>
      {logId ? <AppText variant="caption">{ko.wateredSheet.recordedHint}</AppText> : null}

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
      {/* 흙이 젖었는데 잎이 처진 것은 목마름이 아니라 뿌리 신호다. 주기는 줄이지 않는다 (5.4) */}
      {!hydro && !bonsai && isDroopWarning(soilState ?? 'skipped', checked) ? (
        <AppText variant="caption" color={colors.berry}>
          {ko.wateredSheet.droopWarning}
        </AppText>
      ) : null}

      {/* 분재는 말랐어요를 누르면 바로 끝나므로 비료는 그 위에서 묻는다 */}
      {fertilizerDue && !bonsai ? fertilizerChoice : null}

      {bonsai ? null : photoChoice}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  loading: {
    height: 320,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
  },
  fill: {
    flex: 1,
  },
});
