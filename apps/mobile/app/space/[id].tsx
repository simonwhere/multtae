import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { gradeLight } from '@/api/light-grade';
import { db } from '@/db/client';
import type { Space } from '@/db/schema';
import { deleteSpace } from '@/db/spaces';
import { toCalendarDate } from '@/engine';
import type { LightSource } from '@/engine';
import { ko } from '@/i18n/ko';
import { withObject } from '@/lib/josa';
import { rescheduleSoon } from '@/notifications';
import { deletePhoto, photoUri, pickPhoto } from '@/photos/photo-store';
import type { PhotoSource } from '@/photos/photo-store';
import { DueTag } from '@/plants/due-tag';
import { classifyPlant } from '@/plants/today';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { shownEvidence } from '@/spaces/light-reading';
import type { LightReading } from '@/spaces/light-reading';
import { saveSpacePatch } from '@/spaces/save-space';
import { seasonMemo } from '@/spaces/season-memo';
import { planRetake, spaceLightReading } from '@/spaces/space-edit';
import { useSpaceDetail } from '@/spaces/use-space-detail';
import {
  AppText,
  BackButton,
  Button,
  Card,
  Chevron,
  LightGauge,
  radius,
  spacing,
  Tag,
  TextButton,
  useColors,
} from '@/ui';

type EditField = 'name' | 'light';

/** 밝기를 어떻게 가늠했는지 한 줄 (SPEC 3.3 "AI 판단 근거") */
function lightBasis(source: LightSource, reading: LightReading | null): string {
  const t = ko.spaceDetail;
  if (source === 'manual') return t.basisManual;
  if (source === 'ai') return t.basisPhoto;
  // 사진을 봤는데도 방향으로 갔다면 사진만으로는 또렷하지 않았다는 뜻이다
  return reading ? t.basisUnsure : t.basisDefault;
}

function placeOf(space: Space): string {
  return space.direction === 'unknown'
    ? ko.spaceType[space.spaceType]
    : `${ko.directionName[space.direction]} ${ko.spaceType[space.spaceType]}`;
}

// 공간 상세 (SPEC 3.3): 큰 사진, 사진으로 본 밝기와 근거, 밝기 바꾸기, 이 공간의 식물, 사진 다시 찍기, 계절 메모.
export default function SpaceDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, reload } = useSpaceDetail(id);
  const [retaking, setRetaking] = useState(false);
  const [retakeFailed, setRetakeFailed] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/spaces'));

  if (detail === null || detail === 'missing') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
        <View style={styles.header}>
          <BackButton onPress={close} />
        </View>
        {detail === 'missing' ? (
          <View style={styles.center}>
            <AppText>{ko.spaceDetail.missing}</AppText>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const { space, plants } = detail;
  const t = ko.spaceDetail;
  const context = nowContext(detail.loadedAt);
  const reading = spaceLightReading(space);
  const evidence = shownEvidence(reading);
  const memo = seasonMemo(space.spaceType, context.season);

  const edit = (field: EditField) =>
    router.push({ pathname: '/sheet/space-edit', params: { spaceId: space.id, field } });

  async function retake(source: PhotoSource) {
    setRetakeFailed(false);
    const picked = await pickPhoto(source, 'spaces', space.id);
    if (picked.status === 'canceled') return;
    if (picked.status !== 'picked') {
      setRetakeFailed(true);
      return;
    }

    setRetaking(true);
    const newPath = picked.photo.path;
    try {
      // 새 사진으로 밝기를 다시 읽는다. 못 읽으면 창 방향과 자리로 돌아간다
      const outcome = await gradeLight(newPath, space.direction, space.spaceType);
      const patch = planRetake(space, newPath, outcome.kind === 'reading' ? outcome.reading : null);
      const now = nowContext();
      const recounted = await saveSpacePatch(db, space, patch, {
        ...now,
        today: toCalendarDate(now.now, now.utcOffsetMinutes),
      });

      if (space.photoPath && space.photoPath !== newPath) deletePhoto(space.photoPath);
      if (recounted > 0) rescheduleSoon();
      usePlantUi.getState().bumpGarden();
      reload();
    } catch {
      deletePhoto(newPath);
      setRetakeFailed(true);
    } finally {
      setRetaking(false);
    }
  }

  function chooseRetake() {
    Alert.alert(t.retake, undefined, [
      { text: t.retakeCamera, onPress: () => void retake('camera') },
      { text: t.retakeLibrary, onPress: () => void retake('library') },
      { text: ko.common.cancel, style: 'cancel' },
    ]);
  }

  function confirmDelete() {
    if (plants.length > 0) {
      Alert.alert(t.delete, t.deleteBlocked);
      return;
    }
    Alert.alert(t.deleteTitle(withObject(space.name)), t.deleteBody, [
      { text: ko.common.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void deleteSpace(db, space.id).then(({ deleted, photoPath }) => {
            if (!deleted) return;
            if (photoPath) deletePhoto(photoPath);
            usePlantUi.getState().bumpGarden();
            close();
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <BackButton onPress={close} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.names}>
          <AppText variant="titleLg" accessibilityRole="header">
            {space.name}
          </AppText>
          <View style={styles.tags}>
            {/* 이름을 제안 그대로 두었으면 이름과 같아서 다시 적지 않는다 */}
            {space.name === placeOf(space) ? null : <Tag label={placeOf(space)} />}
            <Tag label={ko.spacesTab.plantCount(plants.length)} />
          </View>
        </View>

        <View style={styles.stack}>
          {space.photoPath ? (
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={t.photo(space.name)}
              contentFit="cover"
              source={{ uri: photoUri(space.photoPath) }}
              style={[styles.photo, { backgroundColor: colors.block }]}
            />
          ) : (
            <View style={[styles.photo, { backgroundColor: colors.block }]} />
          )}
          {retakeFailed ? <AppText>{t.retakeFailed}</AppText> : null}
          <Button
            label={t.retake}
            variant="secondary"
            disabled={retaking}
            onPress={chooseRetake}
          />
        </View>

        <Card style={styles.stack}>
          {retaking ? (
            <View style={styles.reading}>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="titleSm">{t.reading}</AppText>
            </View>
          ) : (
            <>
              <AppText variant="label" color={colors.sub}>
                {t.lightTitle}
              </AppText>
              <View style={styles.gradeRow}>
                <AppText variant="titleLg">{ko.lightGrade[space.lightGrade]}</AppText>
                <LightGauge grade={space.lightGrade} />
              </View>
              <AppText>{ko.lightGradeHint[space.lightGrade]}</AppText>
              <AppText variant="caption">{lightBasis(space.lightSource, reading)}</AppText>
              {space.lightSource === 'ai' && reading?.noteKo ? (
                <AppText>{reading.noteKo}</AppText>
              ) : null}
              {evidence.length > 0 ? (
                <View style={styles.evidence}>
                  <AppText variant="caption">{t.evidence}</AppText>
                  {evidence.map((line) => (
                    <AppText key={line} variant="caption">
                      {line}
                    </AppText>
                  ))}
                </View>
              ) : null}
              <TextButton label={t.editLight} onPress={() => edit('light')} />
            </>
          )}
        </Card>

        {memo ? (
          <Card tone="highlight" style={styles.memo}>
            <AppText variant="label" color={colors.sub}>
              {t.season(ko.seasonMode[context.season])}
            </AppText>
            <AppText>{memo}</AppText>
          </Card>
        ) : null}

        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionTitle}>
            {t.plants}
          </AppText>
          {plants.length === 0 ? (
            <AppText>{t.noPlants}</AppText>
          ) : (
            <View style={styles.grid}>
              {plants.map((plant) => (
                <Card
                  key={plant.id}
                  accessibilityLabel={plant.nickname}
                  onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id } })}
                  style={styles.tile}>
                  {plant.coverPhotoPath ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      contentFit="cover"
                      source={{ uri: photoUri(plant.coverPhotoPath) }}
                      style={[styles.tilePhoto, { backgroundColor: colors.block }]}
                    />
                  ) : (
                    <View style={[styles.tilePhoto, { backgroundColor: colors.block }]} />
                  )}
                  <AppText variant="titleSm" numberOfLines={1}>
                    {plant.nickname}
                  </AppText>
                  <View style={styles.due}>
                    <DueTag soil={classifyPlant(plant, context.now, context.utcOffsetMinutes)} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Card style={styles.rows}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.name} ${space.name}`}
              onPress={() => edit('name')}
              style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
              <AppText variant="caption" style={styles.infoLabel}>
                {t.name}
              </AppText>
              <AppText numberOfLines={1} style={styles.fill}>
                {space.name}
              </AppText>
              <Chevron />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.hair }]} />
            <View style={styles.infoRow}>
              <AppText variant="caption" style={styles.infoLabel}>
                {t.place}
              </AppText>
              <AppText numberOfLines={1} style={styles.fill}>
                {placeOf(space)}
              </AppText>
            </View>
          </Card>
        </View>

        <View style={styles.delete}>
          <TextButton label={t.delete} tone="berry" onPress={confirmDelete} />
        </View>
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
  names: {
    gap: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  stack: {
    gap: spacing.md,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card + 4,
  },
  reading: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidence: {
    gap: spacing.xs,
  },
  memo: {
    gap: spacing.xs + 2,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    marginHorizontal: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  // 두 줄로 놓는다. 홀수면 마지막 칸은 왼쪽에 반 폭으로 남는다
  tile: {
    width: '48%',
    gap: spacing.sm,
  },
  due: {
    alignItems: 'flex-start',
  },
  tilePhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.control,
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
  fill: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  delete: {
    alignItems: 'center',
  },
});
