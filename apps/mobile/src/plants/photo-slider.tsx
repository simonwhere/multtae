import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Photo } from '@/db/schema';
import { toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import { AppText, radius, spacing, Tag, useColors } from '@/ui';

import { formatMonthDay } from './format';

/** 식물 상세의 좌우 가장자리 여백. 사진 한 장이 화면 폭을 채우게 맞춘다 */
const SIDE_PADDING = (spacing.xl - spacing.xs) * 2;

/**
 * 식물 사진 슬라이더 (SPEC.md 8.4 타임랩스). 최근 사진부터 넘겨 보고 찍은 날을 함께 보여 준다.
 * 영상으로 내보내기는 기기에서 영상을 만들 수 있어야 해서 아직 없다.
 */
export function PhotoSlider({
  photos,
  utcOffsetMinutes,
}: {
  photos: readonly Photo[];
  utcOffsetMinutes: number;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pageWidth = Math.max(1, width - SIDE_PADDING);

  if (photos.length === 0) return null;
  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <View style={styles.slider}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth))
        }>
        {photos.map((photo) => (
          <Image
            key={photo.id}
            accessibilityIgnoresInvertColors
            accessibilityLabel={ko.plantDetail.photoOn(
              formatMonthDay(toCalendarDate(photo.takenAt, utcOffsetMinutes)),
            )}
            contentFit="cover"
            source={{ uri: photoUri(photo.path) }}
            style={[styles.photo, { width: pageWidth, backgroundColor: colors.block }]}
          />
        ))}
      </ScrollView>

      <View style={styles.overlay}>
        {current ? (
          <Tag
            label={formatMonthDay(toCalendarDate(current.takenAt, utcOffsetMinutes))}
            tone="surface"
          />
        ) : null}
        {photos.length > 1 ? (
          <View style={[styles.count, { backgroundColor: colors.surface }]}>
            <AppText variant="tag">{ko.plantDetail.photoCount(index + 1, photos.length)}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slider: {
    borderRadius: radius.card + 4,
    overflow: 'hidden',
  },
  photo: {
    height: 230,
  },
  // 사진 위에 날짜와 장수를 얹는다
  overlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: radius.tag,
    paddingHorizontal: spacing.sm + 2,
  },
});
