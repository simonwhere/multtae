import Svg, { Path } from 'react-native-svg';

import { useColors } from './use-colors';

/** 이름표 구석의 잔가지 그림. 꾸밈이라 스크린리더는 읽지 않는다 */
export function Sprig({ size = 84 }: { size?: number }) {
  const colors = useColors();

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      stroke={colors.sprig}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Path d="M48 92 C 46 68, 50 42, 61 14" />
      <Path d="M47 72 C 34 70, 26 60, 24 48 C 38 50, 46 60, 47 72 Z" />
      <Path d="M49 60 C 62 58, 72 48, 74 36 C 60 38, 51 48, 49 60 Z" />
      <Path d="M50 46 C 38 42, 32 32, 32 22 C 44 26, 50 35, 50 46 Z" />
      <Path d="M54 32 C 64 30, 72 22, 74 12 C 63 14, 56 22, 54 32 Z" />
    </Svg>
  );
}
