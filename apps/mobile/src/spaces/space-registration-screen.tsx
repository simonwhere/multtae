import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LIGHT_GRADES } from '@/engine/types';
import type { Direction, SpaceType } from '@/engine/types';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import type { PhotoProblem } from '@/photos/photo-store';
import {
  AppText,
  Button,
  Card,
  ChoiceCard,
  LightGauge,
  Notice,
  RegistrationShell,
  spacing,
  TextButton,
  TextField,
  useColors,
} from '@/ui';

import {
  canAdvance,
  MAX_SPACE_NAME_LENGTH,
  progressOf,
  resolveLight,
  resolveSpaceName,
  SPACE_STEPS,
} from './registration';
import type { SpaceDraft, SpaceDraftAction } from './registration';
import { useSpaceRegistration } from './use-space-registration';

type Dispatch = (action: SpaceDraftAction) => void;

/** SPEC 4.1 표의 순서 */
const SPACE_TYPE_CHOICES: SpaceType[] = ['indoor_window', 'balcony_ext', 'terrace', 'indoor_far'];

const PHOTO_PROBLEM: Record<PhotoProblem, string> = {
  denied: ko.spaceRegister.photo.cameraDenied,
  unavailable: ko.spaceRegister.photo.cameraUnavailable,
  failed: ko.spaceRegister.photo.failed,
};

function PhotoStep({
  draft,
  busy,
  problem,
  onPick,
}: {
  draft: SpaceDraft;
  busy: boolean;
  problem: PhotoProblem | null;
  onPick: (source: 'camera' | 'library') => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.stack}>
      <AppText>{ko.spaceRegister.photo.guide}</AppText>
      <AppText variant="caption">{ko.spaceRegister.photo.landscape}</AppText>
      {draft.photoPath ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={ko.spaceRegister.photo.preview}
          contentFit="cover"
          source={{ uri: photoUri(draft.photoPath) }}
          style={[styles.photo, { backgroundColor: colors.block }]}
        />
      ) : null}
      {problem ? <Notice message={PHOTO_PROBLEM[problem]} /> : null}
      <Button
        label={ko.spaceRegister.photo.camera}
        variant={draft.photoPath ? 'secondary' : 'primary'}
        disabled={busy}
        onPress={() => onPick('camera')}
      />
      <Button
        label={ko.spaceRegister.photo.library}
        variant="secondary"
        disabled={busy}
        onPress={() => onPick('library')}
      />
    </View>
  );
}

function DirectionStep({ draft, dispatch }: { draft: SpaceDraft; dispatch: Dispatch }) {
  const choice = (direction: Direction) => (
    <ChoiceCard
      centered
      label={ko.direction[direction]}
      selected={draft.direction === direction}
      onPress={() => dispatch({ type: 'directionChosen', direction })}
      style={styles.fill}
    />
  );

  return (
    <View style={styles.stack}>
      <AppText variant="caption">{ko.spaceRegister.direction.guide}</AppText>
      {/* 나침반처럼 북은 위, 남은 아래에 둔다 */}
      <View accessibilityRole="radiogroup" style={styles.stack}>
        <View style={styles.row}>
          <View style={styles.fill} />
          {choice('N')}
          <View style={styles.fill} />
        </View>
        <View style={styles.row}>
          {choice('W')}
          <View style={styles.fill} />
          {choice('E')}
        </View>
        <View style={styles.row}>
          <View style={styles.fill} />
          {choice('S')}
          <View style={styles.fill} />
        </View>
        {choice('unknown')}
      </View>
      {draft.direction === 'unknown' ? (
        <Notice message={ko.spaceRegister.direction.unknownWarning} />
      ) : null}
    </View>
  );
}

function TypeStep({ draft, dispatch }: { draft: SpaceDraft; dispatch: Dispatch }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.stack}>
      {SPACE_TYPE_CHOICES.map((spaceType) => (
        <ChoiceCard
          key={spaceType}
          label={ko.spaceType[spaceType]}
          hint={ko.spaceTypeHint[spaceType]}
          selected={draft.spaceType === spaceType}
          onPress={() => dispatch({ type: 'typeChosen', spaceType })}
        />
      ))}
    </View>
  );
}

function LightStep({ draft, dispatch }: { draft: SpaceDraft; dispatch: Dispatch }) {
  const [editing, setEditing] = useState(false);
  const light = resolveLight(draft);
  if (!light) return null;

  return (
    <View style={styles.stack}>
      <Card style={styles.stack}>
        <View style={styles.gradeRow}>
          <AppText variant="titleLg">{ko.lightGrade[light.lightGrade]}</AppText>
          <LightGauge grade={light.lightGrade} />
        </View>
        <AppText>
          {light.lightSource === 'manual'
            ? ko.spaceRegister.light.basisManual
            : ko.spaceRegister.light.basisDefault}
        </AppText>
        <AppText>{ko.lightGradeHint[light.lightGrade]}</AppText>
        <TextButton label={ko.common.edit} onPress={() => setEditing((value) => !value)} />
      </Card>
      {editing ? (
        <View accessibilityRole="radiogroup" style={styles.stack}>
          <AppText variant="caption">{ko.spaceRegister.light.choose}</AppText>
          {LIGHT_GRADES.map((lightGrade) => (
            <ChoiceCard
              key={lightGrade}
              label={ko.lightGrade[lightGrade]}
              hint={ko.lightGradeHint[lightGrade]}
              selected={light.lightGrade === lightGrade}
              onPress={() => dispatch({ type: 'lightGradeChosen', lightGrade })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NameStep({
  draft,
  existingNames,
  dispatch,
}: {
  draft: SpaceDraft;
  existingNames: string[];
  dispatch: Dispatch;
}) {
  return (
    <TextField
      label={ko.spaceRegister.name.label}
      hint={ko.spaceRegister.name.guide}
      maxLength={MAX_SPACE_NAME_LENGTH}
      returnKeyType="done"
      value={draft.name ?? resolveSpaceName(draft, existingNames)}
      onChangeText={(name) => dispatch({ type: 'nameEdited', name })}
    />
  );
}

/** 공간 등록 4단계 + 이름·저장 (SPEC.md 4.1). 한 화면에 한 질문, 진행 표시는 차오르는 흙 게이지 (14.5) */
export function SpaceRegistrationScreen() {
  const router = useRouter();
  const colors = useColors();
  const registration = useSpaceRegistration();
  const { draft, dispatch } = registration;

  if (!draft) {
    return <View style={[styles.screen, { backgroundColor: colors.paper }]} />;
  }

  // 모달로 뜬 게 아니라 이 화면이 첫 화면이면 돌아갈 곳이 없다.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const isFirst = draft.step === SPACE_STEPS[0];
  const isLast = draft.step === SPACE_STEPS[SPACE_STEPS.length - 1];

  async function advance() {
    if (!isLast) {
      dispatch({ type: 'next' });
    } else if (await registration.save()) {
      close();
    }
  }

  return (
    <RegistrationShell
      progress={progressOf(draft)}
      steps={SPACE_STEPS.length}
      progressLabel={ko.spaceRegister.progress}
      title={ko.spaceRegister[draft.step].title}
      onClose={close}
      onBack={isFirst ? undefined : () => dispatch({ type: 'back' })}
      nextLabel={isLast ? ko.common.save : ko.common.next}
      nextDisabled={!canAdvance(draft) || registration.busy}
      onNext={() => void advance()}
      blockedMessage={registration.atLimit ? ko.today.spaceLimit : undefined}
      errorMessage={registration.saveFailed ? ko.spaceRegister.saveFailed : null}>
      {draft.step === 'photo' ? (
        <PhotoStep
          draft={draft}
          busy={registration.busy}
          problem={registration.photoProblem}
          onPick={(source) => void registration.pickPhoto(source)}
        />
      ) : null}
      {draft.step === 'direction' ? <DirectionStep draft={draft} dispatch={dispatch} /> : null}
      {draft.step === 'type' ? <TypeStep draft={draft} dispatch={dispatch} /> : null}
      {draft.step === 'light' ? <LightStep draft={draft} dispatch={dispatch} /> : null}
      {draft.step === 'name' ? (
        <NameStep draft={draft} existingNames={registration.existingNames} dispatch={dispatch} />
      ) : null}
    </RegistrationShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stack: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fill: {
    flex: 1,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: spacing.md,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
