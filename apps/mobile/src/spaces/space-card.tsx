import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Space } from '@/db/schema';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import { AppText, Card, LightGauge, radius, spacing, useColors } from '@/ui';

/** 공간 카드 (SPEC 3.3): 사진, 이름, 방향, 유형, 빛 등급 */
export interface SpaceCardProps {
  space: Space;
  /** 이 공간에 놓인 식물 수 (SPEC 3.3). 없으면 보여 주지 않는다 */
  plantCount?: number;
  /** 식물을 둘 공간을 고를 때 쓴다 */
  selected?: boolean;
  onPress?: () => void;
}

export function SpaceCard({ space, plantCount, selected, onPress }: SpaceCardProps) {
  const colors = useColors();
  const place =
    space.direction === 'unknown'
      ? ko.spaceType[space.spaceType]
      : `${ko.directionName[space.direction]} ${ko.spaceType[space.spaceType]}`;

  return (
    <Card accessibilityLabel={space.name} selected={selected} onPress={onPress} style={styles.card}>
      {space.photoPath ? (
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          source={{ uri: photoUri(space.photoPath) }}
          style={[styles.photo, { backgroundColor: colors.block }]}
        />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.block }]} />
      )}
      <View style={styles.text}>
        <AppText variant="titleSm" numberOfLines={1}>
          {space.name}
        </AppText>
        <AppText variant="caption">
          {plantCount === undefined ? place : `${place}, ${ko.spacesTab.plantCount(plantCount)}`}
        </AppText>
        <View style={styles.light}>
          <AppText variant="caption">{ko.lightGrade[space.lightGrade]}</AppText>
          <LightGauge grade={space.lightGrade} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photo: {
    width: 88,
    height: 66,
    borderRadius: radius.control,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  light: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
