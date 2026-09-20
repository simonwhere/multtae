import Svg, { Path } from 'react-native-svg';

import type { PotSize } from '@/engine';

import { useColors } from './use-colors';

const FRAME = 44;
/** 화분 지름의 대표값(cm)에 비례한 폭. 특대가 그림 폭을 거의 채운다 */
const WIDTH: Record<PotSize, number> = { s: 14, m: 22, l: 32, xl: 40 };

/** 화분 크기를 서로 견주어 볼 수 있게 같은 축척으로 그린 선화 (14.4: 선 1.5pt 단색) */
export function PotIcon({ size }: { size: PotSize }) {
  const colors = useColors();
  const width = WIDTH[size];
  const height = width * 0.8;
  const left = (FRAME - width) / 2;
  const top = FRAME - 2 - height;
  const inset = width * 0.14;

  return (
    <Svg width={FRAME} height={FRAME} accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d={`M${left} ${top} H${left + width} L${left + width - inset} ${top + height} H${left + inset} Z`}
        stroke={colors.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
