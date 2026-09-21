import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import { currentCoefficients } from '@/coefficients';
import { BONSAI_GROUPS } from '@/db/schema';
import type { Space } from '@/db/schema';
import { POT_SIZES, SOIL_TYPES } from '@/engine';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import type { PhotoProblem, PhotoSource } from '@/photos/photo-store';
import { SpaceCard } from '@/spaces/space-card';
import { searchSpecies } from '@/species/seed';
import {
  AppText,
  Button,
  Card,
  ChoiceCard,
  Notice,
  PotIcon,
  RegistrationShell,
  spacing,
  TextButton,
  TextField,
  useColors,
} from '@/ui';

import { DueTag } from './due-tag';
import { formatInterval, formatMonthDay } from './format';
import {
  canAdvance,
  MAX_DAYS_AGO,
  MAX_NICKNAME_LENGTH,
  MAX_PLANT_PHOTOS,
  PLANT_STEPS,
  progressOf,
  resolveNickname,
  SELECTABLE_GROUPS,
} from './registration';
import type { PlantDraft, PlantDraftAction, WateringPreview } from './registration';
import { useIdentify } from './use-identify';
import { usePlantRegistration } from './use-plant-registration';

type Dispatch = (action: PlantDraftAction) => void;

function PhotoStep({
  draft,
  busy,
  problem,
  onPick,
  onRemove,
}: {
  draft: PlantDraft;
  busy: boolean;
  problem: PhotoProblem | null;
  onPick: (source: PhotoSource) => void;
  onRemove: (path: string) => void;
}) {
  const colors = useColors();
  const full = draft.photos.length >= MAX_PLANT_PHOTOS;

  return (
    <View style={styles.stack}>
      <AppText>{ko.plantRegister.photo.guide}</AppText>
      <AppText variant="caption">
        {ko.plantRegister.photo.count(draft.photos.length, MAX_PLANT_PHOTOS)}
      </AppText>
      {draft.photos.length > 0 ? (
        <View style={styles.row}>
          {draft.photos.map((photo) => (
            <View key={photo.path} style={styles.photoCell}>
              {/* 14.4: 식물 사진은 3:4 세로 프레임 */}
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={ko.plantRegister.photo.preview}
                contentFit="cover"
                source={{ uri: photoUri(photo.path) }}
                style={[styles.photo, { backgroundColor: colors.block }]}
              />
              <TextButton
                label={ko.plantRegister.photo.remove}
                onPress={() => onRemove(photo.path)}
              />
            </View>
          ))}
        </View>
      ) : null}
      {problem ? <Notice message={ko.plantRegister.photoProblem[problem]} /> : null}
      <Button
        label={ko.plantRegister.photo.camera}
        variant={draft.photos.length > 0 ? 'secondary' : 'primary'}
        disabled={busy || full}
        onPress={() => onPick('camera')}
      />
      <Button
        label={ko.plantRegister.photo.library}
        variant="secondary"
        disabled={busy || full}
        onPress={() => onPick('library')}
      />
    </View>
  );
}

function SpeciesStep({
  draft,
  dispatch,
  identify,
}: {
  draft: PlantDraft;
  dispatch: Dispatch;
  identify: ReturnType<typeof useIdentify>;
}) {
  const colors = useColors();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState(false);
  const results = searchSpecies(query);
  const chosen = draft.species;
  const t = ko.plantRegister.species;
  const { state, choosing } = identify;

  async function pick(scientificName: string) {
    setNotFound(false);
    const species = await identify.chooseCandidate(scientificName);
    if (!species) {
      // 서버가 정보를 못 만들었다. 식물군만 고르게 한다 (SPEC 9.4)
      setNotFound(true);
      dispatch({ type: 'speciesUnknown' });
      return;
    }
    dispatch({ type: 'speciesChosen', species });
  }

  // 사진을 보는 중
  if (state.status === 'loading' && !searching) {
    return (
      <View style={styles.stack}>
        <View style={styles.identifying}>
          <ActivityIndicator color={colors.accent} />
          <AppText variant="titleSm">{t.identifying}</AppText>
          <AppText variant="caption">{t.identifyWait}</AppText>
        </View>
      </View>
    );
  }

  // 인식 결과가 있고 아직 검색으로 넘어가지 않았다
  const showCandidates = !searching && state.status === 'done' && state.candidates.length > 0;
  const failed = !searching && (state.status === 'failed' || (state.status === 'done' && state.candidates.length === 0));

  return (
    <View style={styles.stack}>
      {showCandidates && state.status === 'done' ? (
        <>
          <AppText variant="caption">{t.candidates}</AppText>
          <View accessibilityRole="radiogroup" style={styles.stack}>
            {state.candidates.map((candidate) => (
              <ChoiceCard
                key={candidate.scientificName}
                label={candidate.nameKo ?? candidate.commonNames[0] ?? candidate.scientificName}
                hint={
                  choosing === candidate.scientificName
                    ? t.loadingSpecies
                    : `${candidate.scientificName} · ${t.candidateHint(candidate.score)}`
                }
                selected={
                  chosen?.kind === 'known' &&
                  chosen.species.scientificName === candidate.scientificName
                }
                onPress={() => void pick(candidate.scientificName)}
              />
            ))}
          </View>
          <TextButton label={t.searchInstead} onPress={() => setSearching(true)} />
        </>
      ) : null}

      {/* 실패하면 바로 아래에 검색이 나오므로 따로 버튼을 두지 않는다 */}
      {failed ? (
        <Notice
          message={
            state.status === 'failed' && state.reason === 'limit'
              ? t.limit
              : state.status === 'done'
                ? t.noMatch
                : t.unavailable
          }
        />
      ) : null}

      {notFound ? <Notice message={t.notFound} /> : null}

      {searching || failed || state.status === 'idle' ? (
        <>
          <TextField
            label={t.search}
            placeholder={t.placeholder}
            autoCorrect={false}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />
          {/* 목록이 길어서 "모르겠어요"는 위에 둔다 */}
          <ChoiceCard
            label={t.unknown}
            hint={t.unknownHint}
            selected={chosen?.kind === 'unknown'}
            onPress={() => dispatch({ type: 'speciesUnknown' })}
          />
          <View accessibilityRole="radiogroup" style={styles.stack}>
            {results.map((species) => (
              <ChoiceCard
                key={species.scientificName}
                label={species.nameKo}
                hint={species.scientificName}
                hintVariant="scientific"
                selected={
                  chosen?.kind === 'known' && chosen.species.scientificName === species.scientificName
                }
                onPress={() => dispatch({ type: 'speciesChosen', species })}
              />
            ))}
            {results.length === 0 ? <AppText>{t.noResult}</AppText> : null}
          </View>
        </>
      ) : null}

      {chosen?.kind === 'unknown' ? (
        <View accessibilityRole="radiogroup" style={styles.stack}>
          <AppText variant="caption">{t.chooseGroup}</AppText>
          {SELECTABLE_GROUPS.map((groupCode) => (
            <ChoiceCard
              key={groupCode}
              label={ko.groupName[groupCode]}
              hint={ko.groupHint[groupCode]}
              selected={chosen.groupCode === groupCode}
              onPress={() => dispatch({ type: 'groupChosen', groupCode })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PotStep({ draft, dispatch }: { draft: PlantDraft; dispatch: Dispatch }) {
  return (
    <View style={styles.stack}>
      <AppText variant="caption">{ko.plantRegister.pot.guide}</AppText>
      <View accessibilityRole="radiogroup" style={styles.stack}>
        {POT_SIZES.map((potSize) => (
          <ChoiceCard
            key={potSize}
            leading={<PotIcon size={potSize} />}
            label={ko.potSize[potSize]}
            hint={ko.potSizeHint[potSize]}
            selected={draft.potSize === potSize}
            onPress={() => dispatch({ type: 'potChosen', potSize })}
          />
        ))}
      </View>
    </View>
  );
}

function SoilStep({ draft, dispatch }: { draft: PlantDraft; dispatch: Dispatch }) {
  return (
    <View style={styles.stack}>
      <View accessibilityRole="radiogroup" style={styles.stack}>
        {SOIL_TYPES.map((soilType) => (
          <ChoiceCard
            key={soilType}
            label={ko.soilType[soilType]}
            hint={ko.soilTypeHint[soilType]}
            selected={draft.soilType === soilType}
            onPress={() => dispatch({ type: 'soilChosen', soilType })}
          />
        ))}
      </View>
      {draft.soilType === 'hydro' ? (
        <Notice message={ko.plantRegister.soil.hydroNote(currentCoefficients().hydroFixedDays)} />
      ) : null}
    </View>
  );
}

function SpaceStep({
  draft,
  spaces,
  dispatch,
  onRegisterSpace,
}: {
  draft: PlantDraft;
  spaces: Space[];
  dispatch: Dispatch;
  onRegisterSpace: () => void;
}) {
  return (
    <View style={styles.stack}>
      {spaces.length === 0 ? <AppText>{ko.plantRegister.space.empty}</AppText> : null}
      <View accessibilityRole="radiogroup" style={styles.stack}>
        {spaces.map((space) => (
          <SpaceCard
            key={space.id}
            space={space}
            selected={draft.spaceId === space.id}
            onPress={() => dispatch({ type: 'spaceChosen', spaceId: space.id })}
          />
        ))}
      </View>
      {/* 4.2: 공간이 없으면 여기서 공간 등록으로 간다 */}
      <Button
        label={spaces.length === 0 ? ko.today.registerSpace : ko.today.addSpace}
        variant={spaces.length === 0 ? 'primary' : 'secondary'}
        onPress={onRegisterSpace}
      />
    </View>
  );
}

function BonsaiStep({ draft, dispatch }: { draft: PlantDraft; dispatch: Dispatch }) {
  const colors = useColors();

  return (
    <View style={styles.stack}>
      <Card style={styles.switchRow}>
        <AppText style={styles.fill}>{ko.plantRegister.bonsai.toggle}</AppText>
        <Switch
          accessibilityLabel={ko.plantRegister.bonsai.toggle}
          ios_backgroundColor={colors.gaugeEmpty}
          thumbColor={colors.surface}
          trackColor={{ false: colors.gaugeEmpty, true: colors.accent }}
          value={draft.isBonsai}
          onValueChange={(isBonsai) => dispatch({ type: 'bonsaiToggled', isBonsai })}
        />
      </Card>
      <AppText variant="caption">{ko.plantRegister.bonsai.guide}</AppText>
      {draft.isBonsai ? (
        <View accessibilityRole="radiogroup" style={styles.stack}>
          <AppText variant="caption">{ko.plantRegister.bonsai.chooseGroup}</AppText>
          {BONSAI_GROUPS.map((bonsaiGroup) => (
            <ChoiceCard
              key={bonsaiGroup}
              label={ko.bonsaiGroup[bonsaiGroup]}
              hint={ko.bonsaiGroupHint[bonsaiGroup]}
              selected={draft.bonsaiGroup === bonsaiGroup}
              onPress={() => dispatch({ type: 'bonsaiGroupChosen', bonsaiGroup })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function daysAgoLabel(days: number): string {
  if (days === 0) return ko.plantRegister.finish.today;
  if (days === 1) return ko.plantRegister.finish.yesterday;
  return ko.plantRegister.finish.daysAgo(days);
}

function FinishStep({
  draft,
  preview,
  existingNicknames,
  dispatch,
}: {
  draft: PlantDraft;
  preview: WateringPreview | null;
  existingNicknames: string[];
  dispatch: Dispatch;
}) {
  const finish = ko.plantRegister.finish;

  return (
    <View style={styles.stack}>
      <TextField
        label={finish.nickname}
        maxLength={MAX_NICKNAME_LENGTH}
        returnKeyType="done"
        value={draft.nickname ?? resolveNickname(draft, existingNicknames)}
        onChangeText={(nickname) => dispatch({ type: 'nicknameEdited', nickname })}
      />

      <Card style={styles.stack}>
        <AppText variant="caption">{finish.lastWatered}</AppText>
        <View style={styles.stepper}>
          <Button
            label={finish.earlier}
            variant="secondary"
            disabled={draft.wateredUnknown || draft.wateredDaysAgo >= MAX_DAYS_AGO}
            onPress={() =>
              dispatch({ type: 'wateredDaysAgoChanged', days: draft.wateredDaysAgo + 1 })
            }
          />
          <View style={styles.stepperValue}>
            <AppText variant="titleSm">
              {draft.wateredUnknown ? finish.unknownShort : daysAgoLabel(draft.wateredDaysAgo)}
            </AppText>
            {preview && !draft.wateredUnknown ? (
              <AppText variant="caption">{formatMonthDay(preview.lastWatered)}</AppText>
            ) : null}
          </View>
          <Button
            label={finish.later}
            variant="secondary"
            disabled={draft.wateredUnknown || draft.wateredDaysAgo <= 0}
            onPress={() =>
              dispatch({ type: 'wateredDaysAgoChanged', days: draft.wateredDaysAgo - 1 })
            }
          />
        </View>
        <ChoiceCard
          label={finish.unknown}
          selected={draft.wateredUnknown}
          onPress={() =>
            dispatch({ type: 'wateredUnknownToggled', unknown: !draft.wateredUnknown })
          }
        />
      </Card>

      {preview ? (
        <Card style={styles.stack}>
          <AppText variant="caption">{finish.nextWater}</AppText>
          <View style={styles.nextRow}>
            <AppText variant="titleLg" style={styles.fill}>
              {formatMonthDay(preview.nextWater)}
            </AppText>
            <DueTag
              soil={{
                status: preview.daysLeft < 0 ? 'overdue' : preview.daysLeft === 0 ? 'due' : 'moist',
                daysLeft: preview.daysLeft,
              }}
            />
          </View>
          <AppText variant="caption">{formatInterval(preview.result)}</AppText>
          {draft.wateredUnknown ? <AppText>{finish.unknownNote(preview.days)}</AppText> : null}
          {preview.result.mode === 'computed' && preview.result.belowMin && !draft.isBonsai ? (
            <AppText>{finish.belowMin}</AppText>
          ) : null}
          {preview.daysLeft < 0 ? <AppText>{finish.overdueNote}</AppText> : null}
        </Card>
      ) : null}
    </View>
  );
}

/** 식물 등록 6단계 + 첫 알림 확인 (SPEC.md 4.2). 한 화면에 한 질문, 진행 표시는 차오르는 흙 게이지 (14.5) */
export function PlantRegistrationScreen() {
  const router = useRouter();
  const colors = useColors();
  const registration = usePlantRegistration();
  const identify = useIdentify();
  const { draft, dispatch } = registration;

  if (!draft) {
    return <View style={[styles.screen, { backgroundColor: colors.paper }]} />;
  }

  // 모달로 뜬 게 아니라 이 화면이 첫 화면이면 돌아갈 곳이 없다.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const isFirst = draft.step === PLANT_STEPS[0];
  const isLast = draft.step === PLANT_STEPS[PLANT_STEPS.length - 1];

  const current = draft;

  async function advance() {
    if (isLast) {
      if (await registration.save()) close();
      return;
    }

    // 사진을 다 고르고 넘어가는 참에 인식을 시작한다. 종 단계에 닿으면 결과가 나와 있다 (SPEC 4.2).
    // 실패했으면 사진을 바꿔 다시 올 수 있으니 또 해 본다. 이미 후보를 받았으면 그대로 쓴다
    if (
      current.step === 'photo' &&
      (identify.state.status === 'idle' || identify.state.status === 'failed')
    ) {
      void identify.identify(current.photos.map((photo) => photo.path));
    }
    dispatch({ type: 'next' });
  }

  return (
    <RegistrationShell
      progress={progressOf(draft)}
      steps={PLANT_STEPS.length}
      progressLabel={ko.plantRegister.progress}
      title={ko.plantRegister[draft.step].title}
      onClose={close}
      onBack={isFirst ? undefined : () => dispatch({ type: 'back' })}
      nextLabel={isLast ? ko.common.save : ko.common.next}
      nextDisabled={!canAdvance(draft) || registration.busy || (isLast && !registration.preview)}
      onNext={() => void advance()}
      blockedMessage={registration.atLimit ? ko.today.plantLimit : undefined}
      errorMessage={registration.saveFailed ? ko.plantRegister.saveFailed : null}>
      {draft.step === 'photo' ? (
        <PhotoStep
          draft={draft}
          busy={registration.busy}
          problem={registration.photoProblem}
          onPick={(source) => void registration.pickPhoto(source)}
          onRemove={registration.removePhoto}
        />
      ) : null}
      {draft.step === 'species' ? <SpeciesStep draft={draft} dispatch={dispatch} identify={identify} /> : null}
      {draft.step === 'pot' ? <PotStep draft={draft} dispatch={dispatch} /> : null}
      {draft.step === 'soil' ? <SoilStep draft={draft} dispatch={dispatch} /> : null}
      {draft.step === 'space' ? (
        <SpaceStep
          draft={draft}
          spaces={registration.spaces}
          dispatch={dispatch}
          onRegisterSpace={() => router.push('/register/space')}
        />
      ) : null}
      {draft.step === 'bonsai' ? <BonsaiStep draft={draft} dispatch={dispatch} /> : null}
      {draft.step === 'finish' ? (
        <FinishStep
          draft={draft}
          preview={registration.preview}
          existingNicknames={registration.existingNicknames}
          dispatch={dispatch}
        />
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
  photoCell: {
    flex: 1,
    maxWidth: '33%',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  identifying: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
