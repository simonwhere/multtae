import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { db } from '@/db/client';
import type { Space } from '@/db/schema';
import { getSpace } from '@/db/spaces';
import type { SpacePatch } from '@/db/spaces';
import { LIGHT_GRADES, toCalendarDate } from '@/engine';
import type { LightGrade } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { MAX_SPACE_NAME_LENGTH } from '@/spaces/registration';
import { saveSpacePatch } from '@/spaces/save-space';
import { planLightGrade, planSpaceName } from '@/spaces/space-edit';
import { AppText, Button, ChoiceCard, spacing, TextField } from '@/ui';

type Field = 'name' | 'light';

// 공간 상세의 편집 시트 (SPEC 3.3): 이름, 밝기.
// 밝기를 바꾸면 이 공간 식물의 물 주는 날을 바로 다시 세고 알림도 다시 예약한다.
export default function SpaceEditSheet() {
  const router = useRouter();
  const { spaceId, field } = useLocalSearchParams<{ spaceId: string; field: Field }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [name, setName] = useState('');
  const [lightGrade, setLightGrade] = useState<LightGrade>('medium');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getSpace(db, spaceId).then((found) => {
      if (!found) return;
      setSpace(found);
      setName(found.name);
      setLightGrade(found.lightGrade);
    });
  }, [spaceId]);

  if (!space) return <View style={styles.sheet} />;

  const t = ko.spaceDetail;
  const patch: SpacePatch | null =
    field === 'name' ? planSpaceName(space, name) : planLightGrade(space, lightGrade);
  // 이름은 비었거나 너무 길면 저장할 수 없다. 밝기는 늘 고른 값이 있다
  const canSave = field !== 'name' || name.trim() === space.name || patch !== null;

  async function save() {
    if (!space || busy) return;
    if (!patch) {
      router.back();
      return;
    }

    setBusy(true);
    setFailed(false);
    try {
      const context = nowContext();
      const recounted = await saveSpacePatch(db, space, patch, {
        ...context,
        today: toCalendarDate(context.now, context.utcOffsetMinutes),
      });
      if (recounted > 0) rescheduleSoon();
      usePlantUi.getState().bumpGarden();
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <View style={styles.sheet}>
      {field === 'name' ? (
        <TextField
          autoFocus
          label={t.nameLabel}
          maxLength={MAX_SPACE_NAME_LENGTH}
          returnKeyType="done"
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void save()}
        />
      ) : (
        <>
          <AppText variant="titleSm" accessibilityRole="header">
            {t.chooseLight}
          </AppText>
          <View accessibilityRole="radiogroup" style={styles.stack}>
            {LIGHT_GRADES.map((grade) => (
              <ChoiceCard
                key={grade}
                label={ko.lightGrade[grade]}
                hint={ko.lightGradeHint[grade]}
                selected={lightGrade === grade}
                onPress={() => setLightGrade(grade)}
              />
            ))}
          </View>
        </>
      )}

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
  stack: {
    gap: spacing.sm,
  },
});
