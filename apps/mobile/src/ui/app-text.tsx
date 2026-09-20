import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { typography } from './tokens';
import type { TypographyToken } from './tokens';
import { useColors } from './use-colors';

export interface AppTextProps extends TextProps {
  /** 14.3 타이포 스케일. 기본은 본문 */
  variant?: TypographyToken;
  /** 색 토큰 값. 기본은 글자색(ink) */
  color?: string;
}

export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  const colors = useColors();

  return <Text {...rest} style={[typography[variant], { color: color ?? colors.ink }, style]} />;
}
