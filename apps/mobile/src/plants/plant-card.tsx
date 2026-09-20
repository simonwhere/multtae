import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { PlantWithSpace } from '@/db/plants';
import { getSoilGaugeState, toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import { findSeedSpecies } from '@/species/seed';
import { AppText, Card, SoilGauge, spacing, useColors } from '@/ui';

import { DaysLeft } from './days-left';

export interface PlantCardProps extends PlantWithSpace {
  /** 지금 시각(epoch ms)과 기기 시간대 오프셋(분). 목록의 모든 카드가 같은 "오늘"을 보게 밖에서 받는다 */
  now: number;
  utcOffsetMinutes: number;
}

/** 식물 카드: 3:4 사진, 별명, 학명, 공간, D-day, 흙 게이지 (SPEC 3.2, 14.1) */
export function PlantCard({ plant, space, now, utcOffsetMinutes }: PlantCardProps) {
  const colors = useColors();
  const today = toCalendarDate(now, utcOffsetMinutes);
  const soil = getSoilGaugeState(
    toCalendarDate(plant.lastWateredAt, utcOffsetMinutes),
    toCalendarDate(plant.nextWaterAt ?? plant.lastWateredAt, utcOffsetMinutes),
    today,
  );
  const species = plant.scientificName ? findSeedSpecies(plant.scientificName) : undefined;

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        {plant.coverPhotoPath ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="cover"
            source={{ uri: photoUri(plant.coverPhotoPath) }}
            style={[styles.photo, { backgroundColor: colors.soil.dry }]}
          />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.soil.dry }]} />
        )}
        <View style={styles.text}>
          <AppText variant="titleSm" numberOfLines={1}>
            {plant.nickname}
          </AppText>
          {species ? (
            <AppText variant="scientific" numberOfLines={1}>
              {species.scientificName}
            </AppText>
          ) : (
            <AppText variant="formula">{ko.groupName[plant.groupCode]}</AppText>
          )}
          <AppText variant="formula" numberOfLines={1}>
            {space.name}
          </AppText>
        </View>
        <DaysLeft daysLeft={soil.daysLeft} />
      </View>
      <SoilGauge
        variant={plant.isBonsai ? 'pot' : 'band'}
        status={soil.status}
        moisture={soil.moisture}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photo: {
    width: 60,
    height: 80,
    borderRadius: spacing.sm,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
});
