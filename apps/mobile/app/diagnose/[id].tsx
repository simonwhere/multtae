import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { diagnosePlant } from '@/api/diagnose';
import { db } from '@/db/client';
import { insertEvent } from '@/db/events';
import { getPlantWithSpace } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import { getCachedSpecies } from '@/db/species-cache';
import { listPlantWaterings } from '@/db/watering';
import { ko } from '@/i18n/ko';
import { getDeviceId } from '@/lib/device-id';
import { deletePhoto, photoUri, pickPhoto } from '@/photos/photo-store';
import type { PhotoProblem, PhotoSource } from '@/photos/photo-store';
import { findSeedSpecies } from '@/species/seed';
import { AppText, Button, Notice, radius, spacing, TextButton, useColors } from '@/ui';

const MAX_PHOTOS = 3;

type Status = 'idle' | 'running' | 'limit' | 'failed';

const PHOTO_PROBLEM: Record<PhotoProblem, string> = {
  denied: ko.diagnose.cameraDenied,
  unavailable: ko.diagnose.cameraUnavailable,
  failed: ko.diagnose.photoFailed,
};

// 상태 진단 (SPEC 8.1): 사진 1~3장 → 진단 → 결과. 기기당 하루 3회.
// 사진은 서버에 저장하지 않고, 기기에는 첫 장만 기록 탭 썸네일로 남긴다.
export default function DiagnoseScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [target, setTarget] = useState<PlantWithSpace | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [photoProblem, setPhotoProblem] = useState<PhotoProblem | null>(null);
  // 결과로 넘어간 사진은 남기고, 그냥 나가면 고른 사진을 지운다
  const kept = useRef(false);
  const latestPhotos = useRef<string[]>([]);
  latestPhotos.current = photos;

  useEffect(() => {
    void getPlantWithSpace(db, id).then(setTarget);
    return () => {
      if (!kept.current) latestPhotos.current.forEach(deletePhoto);
    };
  }, [id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!target) return <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]} />;
  const { plant } = target;
  const t = ko.diagnose;

  async function addPhoto(source: PhotoSource) {
    setPhotoProblem(null);
    const result = await pickPhoto(source, 'plants', plant.id);
    if (result.status === 'picked') setPhotos((current) => [...current, result.photo.path]);
    else if (result.status !== 'canceled') setPhotoProblem(result.status);
  }

  function removePhoto(path: string) {
    deletePhoto(path);
    setPhotos((current) => current.filter((item) => item !== path));
  }

  async function run() {
    if (photos.length === 0 || status === 'running') return;
    setStatus('running');

    const [deviceId, recent, species] = await Promise.all([
      getDeviceId(db, randomUUID),
      listPlantWaterings(db, plant.id, 5),
      plant.scientificName ? getCachedSpecies(db, plant.scientificName) : Promise.resolve(null),
    ]);
    const outcome = await diagnosePlant({
      photoPaths: photos,
      deviceId,
      species:
        species?.nameKo ??
        (plant.scientificName ? findSeedSpecies(plant.scientificName)?.nameKo : undefined) ??
        plant.scientificName,
      groupCode: plant.groupCode,
      recent: recent.map((log) => ({
        date: new Date(log.wateredAt).toISOString(),
        soilState: log.soilState,
        leafDroop: log.leafDroop,
      })),
    });

    if (outcome.kind !== 'diagnosis') {
      setStatus(outcome.kind === 'limit' ? 'limit' : 'failed');
      return;
    }

    // 기록 탭에는 첫 사진만 썸네일로 남긴다 (8.1 기록)
    const eventId = randomUUID();
    await insertEvent(db, {
      id: eventId,
      plantId: plant.id,
      type: 'diagnose',
      occurredAt: Date.now(),
      payload: outcome.diagnosis,
      photoPath: photos[0],
    });
    photos.slice(1).forEach(deletePhoto);
    kept.current = true;
    router.replace({
      pathname: '/diagnosis/[eventId]',
      params: { eventId, remaining: String(outcome.remaining) },
    });
  }

  if (status === 'running') {
    return (
      <SafeAreaView style={[styles.screen, styles.center, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.accent} />
        <AppText variant="titleSm">{t.running}</AppText>
        <AppText variant="caption">{t.runningWait}</AppText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <TextButton label={ko.common.close} onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="titleLg" accessibilityRole="header">
          {t.title(plant.nickname)}
        </AppText>
        <AppText>{t.guide}</AppText>

        {photos.length > 0 ? (
          <View style={styles.photos}>
            {photos.map((path, index) => (
              <View key={path} style={styles.photoCell}>
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={t.photo(index + 1)}
                  contentFit="cover"
                  source={{ uri: photoUri(path) }}
                  style={[styles.photo, { backgroundColor: colors.block }]}
                />
                <TextButton label={t.removePhoto} onPress={() => removePhoto(path)} />
              </View>
            ))}
          </View>
        ) : null}

        {photoProblem ? <Notice message={PHOTO_PROBLEM[photoProblem]} /> : null}
        {status === 'limit' ? <Notice message={t.limit} /> : null}
        {status === 'failed' ? <Notice message={t.failed} /> : null}

        {photos.length < MAX_PHOTOS ? (
          <View style={styles.stack}>
            <Button label={t.camera} variant="secondary" onPress={() => void addPhoto('camera')} />
            <Button label={t.library} variant="secondary" onPress={() => void addPhoto('library')} />
          </View>
        ) : (
          <AppText variant="caption">{t.maxPhotos}</AppText>
        )}

        <Button label={t.run} disabled={photos.length === 0} onPress={() => void run()} />
        <AppText variant="caption" style={styles.centerText}>
          {t.daily}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl - spacing.xs,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingBottom: spacing.xl * 2,
  },
  photos: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoCell: {
    width: '31.5%',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.control,
  },
  stack: {
    gap: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
});
