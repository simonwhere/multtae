import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { SoilGaugeState } from '@/engine/soil';
import { ko } from '@/i18n/ko';

import { gaugeCells } from './gauge-cells';
import { motion, radius } from './tokens';
import { useColors } from './use-colors';

const CELL_HEIGHT = 8;
const CELL_GAP = 3;

export interface DayGaugeProps extends Pick<SoilGaugeState, 'status' | 'moisture' | 'totalDays'> {
  /** 강조 면(새순 연두) 위에 놓였다. 빈 칸을 카드 면 색으로 그린다 */
  onHighlight?: boolean;
  /** 방금 물을 줬다. 빈 데서부터 왼쪽 칸부터 차례로 찬다 (14.1) */
  animateFill?: boolean;
  /** 스크린리더 문구. 없으면 상태별 기본 문구 */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function Cell({
  index,
  filled,
  progress,
  emptyColor,
  fillColor,
}: {
  index: number;
  filled: boolean;
  /** 0 → 찬 칸 수. 이 값이 칸 번호를 지나가면 그 칸이 찬다 */
  progress: SharedValue<number>;
  emptyColor: string;
  fillColor: string;
}) {
  const fill = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(progress.value - index, 0), 1),
  }));

  return (
    <View style={[styles.cell, { backgroundColor: emptyColor }]}>
      {filled ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: fillColor }, fill]} />
      ) : null}
    </View>
  );
}

/**
 * 물주기 게이지 (SPEC.md 14.1). 하루가 한 칸이고 다음 물주기까지 남은 날만큼 왼쪽부터 차 있다.
 * 물 줄 날과 밀린 날은 전부 비어 있고, 밀리면 빈 칸이 자줏빛이다. 상태는 옆의 이름표가 글자로도 말한다.
 */
export function DayGauge({
  status,
  moisture,
  totalDays,
  onHighlight = false,
  animateFill = false,
  accessibilityLabel,
  style,
}: DayGaugeProps) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const { cells, filled } = gaugeCells({ status, moisture, totalDays });
  const animated = animateFill && !reducedMotion;
  const progress = useSharedValue(animated ? 0 : filled);

  useEffect(() => {
    progress.value = animated
      ? withTiming(filled, { duration: motion.gauge, easing: Easing.out(Easing.quad) })
      : filled;
  }, [animated, filled, progress]);

  const emptyColor =
    status === 'overdue'
      ? colors.berryEmpty
      : onHighlight
        ? colors.gaugeEmptyOnHighlight
        : colors.gaugeEmpty;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? ko.soilGauge[status]}
      style={[styles.gauge, style]}>
      {Array.from({ length: cells }, (_, index) => (
        <Cell
          key={index}
          index={index}
          filled={index < filled}
          progress={progress}
          emptyColor={emptyColor}
          fillColor={colors.accent}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: radius.gauge,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.gauge,
  },
});
