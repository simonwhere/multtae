import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Plant, Space } from '@/db/schema';
import type { SoilGaugeState } from '@/engine';
import { photoUri } from '@/photos/photo-store';
import { AppText, Card, DayGauge, radius, spacing, useColors } from '@/ui';

import { DueTag } from './due-tag';

export interface PlantCardProps {
  plant: Plant;
  space: Space;
  /** getSoilGaugeState 의 결과. 목록의 모든 카드가 같은 "오늘"을 보게 밖에서 계산해 받는다 */
  soil: SoilGaugeState;
  /** 오늘 물을 준 카드. 이름표 자리에 완료를 보여 준다 */
  done?: boolean;
  /** 방금 물을 줬다. 게이지가 빈 데서부터 왼쪽 칸부터 찬다 (14.1) */
  justWatered?: boolean;
  /** 오늘 물 줄 카드. 새순 연두의 강조 면으로 그린다 */
  highlighted?: boolean;
  /** 이름 아래 한 줄. 없으면 공간 이름 */
  note?: string;
  onPress?: () => void;
  /** 카드 아래의 동작 버튼들 */
  children?: React.ReactNode;
}

const PHOTO_SIZE = 56;

/** 식물 카드: 사진, 별명, 공간, 남은 날 이름표, 하루 한 칸 게이지 (SPEC 3.2, 14.1) */
export function PlantCard({
  plant,
  space,
  soil,
  done,
  justWatered,
  highlighted = false,
  note,
  onPress,
  children,
}: PlantCardProps) {
  const colors = useColors();

  return (
    <Card
      accessibilityLabel={plant.nickname}
      onPress={onPress}
      tone={highlighted ? 'highlight' : 'surface'}
      style={styles.card}>
      <View style={styles.top}>
        {plant.coverPhotoPath ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="cover"
            source={{ uri: photoUri(plant.coverPhotoPath) }}
            style={[styles.photo, { backgroundColor: colors.block }]}
          />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.block }]} />
        )}
        <View style={styles.text}>
          <AppText variant="titleSm" numberOfLines={1}>
            {plant.nickname}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {note ?? space.name}
          </AppText>
        </View>
        <DueTag soil={soil} done={done} onHighlight={highlighted} />
      </View>
      <DayGauge
        status={done ? 'moist' : soil.status}
        moisture={soil.moisture}
        totalDays={soil.totalDays}
        onHighlight={highlighted}
        animateFill={justWatered}
      />
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md + 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.control,
  },
  text: {
    flex: 1,
    gap: 3,
  },
});
