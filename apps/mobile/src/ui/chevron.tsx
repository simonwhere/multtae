import Svg, { Path } from 'react-native-svg';

import { useColors } from './use-colors';

const SIZE = 16;

/** 눌러서 들어가는 줄의 오른쪽 꺾쇠. 선 굵기는 탭 아이콘과 맞춘다 */
export function Chevron() {
  const colors = useColors();

  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M6 3l5 5-5 5"
        stroke={colors.ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}
