import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { SoilStatus } from '@/engine/soil';
import { ko } from '@/i18n/ko';

import { crackPath, potOutlinePath, potShapePath } from './soil-texture';
import { motion, radius } from './tokens';
import { useColors } from './use-colors';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const HEIGHT = { band: 12, pot: 22 } as const;
/** 젖은 흙과 마른 흙 사이가 번지는 폭 */
const FADE_WIDTH = 24;

export interface SoilGaugeProps {
  status: SoilStatus;
  /** 젖은 흙의 비율 0~1 (getSoilGaugeState). status 가 moist 가 아니면 0 으로 본다 */
  moisture: number;
  /** band: 가로로 긴 흙 단면 띠, pot: 분재용 얕은 화분 단면 */
  variant?: 'band' | 'pot';
  /** 처음 나타날 때 이 값에서 moisture 까지 번지며 찬다. 방금 물을 준 카드에 0 을 준다 */
  fillFrom?: number;
  /** 스크린리더 문구. 없으면 상태별 기본 문구 */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 흙 게이지 (SPEC.md 14.1). 왼쪽이 젖은 흙이고 날이 갈수록 젖은 영역이 줄어든다.
 * 물 줄 날은 전부 마른 색에 잔금, 밀리면 회갈색에 균열. 색만으로 구분하지 않도록 상태마다 질감이 다르다.
 * moisture 가 바뀌면 600ms 동안 왼쪽부터 번진다 ("물 줬어요").
 */
export function SoilGauge({
  status,
  moisture,
  variant = 'band',
  fillFrom,
  accessibilityLabel,
  style,
}: SoilGaugeProps) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const height = HEIGHT[variant];
  const wet = status === 'moist' ? Math.min(Math.max(moisture, 0), 1) : 0;

  const level = useSharedValue(fillFrom ?? wet);
  useEffect(() => {
    level.set(withTiming(wet, { duration: motion.soilGauge, easing: Easing.out(Easing.cubic) }));
  }, [level, wet]);

  // 번지는 구간까지 합쳐 움직여야 0 에서는 아무것도 안 보이고 1 에서는 끝까지 젖는다.
  const wetProps = useAnimatedProps(() => ({
    width: Math.max(0, level.get() * (width + FADE_WIDTH) - FADE_WIDTH),
  }));
  const fadeProps = useAnimatedProps(() => ({
    x: level.get() * (width + FADE_WIDTH) - FADE_WIDTH,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? ko.soilGauge[status]}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(wet * 100) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ height }, style]}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <ClipPath id="soil">
              {variant === 'pot' ? (
                <Path d={potShapePath(width, height)} />
              ) : (
                <Rect width={width} height={height} rx={radius.gauge} />
              )}
            </ClipPath>
            <LinearGradient id="seep" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.soil.wet} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.soil.wet} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <G clipPath="url(#soil)">
            <Rect
              width={width}
              height={height}
              fill={status === 'overdue' ? colors.soil.crack : colors.soil.dry}
            />
            {status !== 'moist' && (
              <Path
                d={crackPath(width, height, status === 'overdue' ? 'deep' : 'fine')}
                stroke={colors.ink}
                strokeWidth={status === 'overdue' ? 1.5 : 0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            <AnimatedRect animatedProps={wetProps} height={height} fill={colors.soil.wet} />
            <AnimatedRect
              animatedProps={fadeProps}
              width={FADE_WIDTH}
              height={height}
              fill="url(#seep)"
            />
          </G>
          {variant === 'pot' && (
            <Path
              d={potOutlinePath(width, height)}
              stroke={colors.ink}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>
      )}
    </View>
  );
}
