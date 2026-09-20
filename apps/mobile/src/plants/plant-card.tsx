import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Plant, Space } from '@/db/schema';
import type { SoilGaugeState } from '@/engine';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import { findSeedSpecies } from '@/species/seed';
import { AppText, Card, SoilGauge, spacing, useColors } from '@/ui';

import { DaysLeft } from './days-left';

export interface PlantCardProps {
  plant: Plant;
  space: Space;
  /** getSoilGaugeState 의 결과. 목록의 모든 카드가 같은 "오늘"을 보게 밖에서 계산해 받는다 */
  soil: SoilGaugeState;
  /** 오늘 물을 준 카드. D-day 자리에 완료를 보여 준다 (초록은 완료 상태 전용, 14.2) */
  done?: boolean;
  /** 방금 물을 줬다. 게이지가 마른 데서부터 번지며 찬다 (14.1) */
  justWatered?: boolean;
  onPress?: () => void;
  /** 카드 아래의 동작 버튼들 */
  children?: React.ReactNode;
}

/** 식물 카드: 3:4 사진, 별명, 학명, 공간, D-day, 흙 게이지 (SPEC 3.2, 14.1) */
export function PlantCard({ plant, space, soil, done, justWatered, onPress, children }: PlantCardProps) {
  const colors = useColors();
  const species = plant.scientificName ? findSeedSpecies(plant.scientificName) : undefined;

  return (
    <Card accessibilityLabel={plant.nickname} onPress={onPress} style={styles.card}>
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
        {done ? (
          <AppText variant="titleSm" color={colors.moss}>
            {ko.today.doneBadge}
          </AppText>
        ) : (
          <DaysLeft daysLeft={soil.daysLeft} />
        )}
      </View>
      <SoilGauge
        variant={plant.isBonsai ? 'pot' : 'band'}
        status={soil.status}
        moisture={soil.moisture}
        fillFrom={justWatered ? 0 : undefined}
      />
      {children}
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
