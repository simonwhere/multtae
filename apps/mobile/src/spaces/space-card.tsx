import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Space } from '@/db/schema';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/space-photo';
import { AppText, Card, LightGauge, spacing, useColors } from '@/ui';

/** 공간 카드 (SPEC 3.3): 사진, 이름, 방향, 유형, 빛 등급 */
export function SpaceCard({ space }: { space: Space }) {
  const colors = useColors();
  const place =
    space.direction === 'unknown'
      ? ko.spaceType[space.spaceType]
      : `${ko.directionName[space.direction]} ${ko.spaceType[space.spaceType]}`;

  return (
    <Card style={styles.card}>
      {space.photoPath ? (
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          source={{ uri: photoUri(space.photoPath) }}
          style={[styles.photo, { backgroundColor: colors.soil.dry }]}
        />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.soil.dry }]} />
      )}
      <View style={styles.text}>
        <AppText variant="titleSm" numberOfLines={1}>
          {space.name}
        </AppText>
        <AppText variant="formula">{place}</AppText>
        <View style={styles.light}>
          <AppText variant="formula">{ko.lightGrade[space.lightGrade]}</AppText>
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
    borderRadius: spacing.sm,
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
