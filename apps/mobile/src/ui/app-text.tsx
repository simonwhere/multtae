import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { typography } from './tokens';
import type { TypographyToken } from './tokens';
import { useColors } from './use-colors';

export interface AppTextProps extends TextProps {
  /** 14.3 타이포 스케일. 기본은 본문 */
  variant?: TypographyToken;
  /** 색 토큰 값. 기본은 글자색(ink)이고, 작은 글자와 학명은 보조 글자색(sub)이다 */
  color?: string;
}

export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  const colors = useColors();
  const base = variant === 'caption' || variant === 'scientific' ? colors.sub : colors.ink;

  return (
    <Text
      // 한글이 단어 중간에서 줄바꿈되지 않게 한다 (iOS 기본은 글자 단위)
      lineBreakStrategyIOS="hangul-word"
      {...rest}
      style={[typography[variant], { color: color ?? base }, style]}
    />
  );
}
