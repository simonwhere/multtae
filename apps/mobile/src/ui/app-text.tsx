import { Children } from 'react';
import { Platform, Text } from 'react-native';
import type { TextProps } from 'react-native';

import { keepHangulWords } from '@/lib/keep-words';

import { typography } from './tokens';
import type { TypographyToken } from './tokens';
import { useColors } from './use-colors';

export interface AppTextProps extends TextProps {
  /** 14.3 타이포 스케일. 기본은 본문 */
  variant?: TypographyToken;
  /** 색 토큰 값. 기본은 글자색(ink)이고, 작은 글자와 학명은 보조 글자색(sub)이다 */
  color?: string;
}

/** 안드로이드는 줄바꿈 설정이 없어 글자에 직접 넣는다 (lib/keep-words.ts) */
function keepWords(children: React.ReactNode): React.ReactNode {
  if (Platform.OS !== 'android') return children;
  if (typeof children === 'string') return keepHangulWords(children);
  return Children.map(children, (child) =>
    typeof child === 'string' ? keepHangulWords(child) : child,
  );
}

export function AppText({ variant = 'body', color, style, children, ...rest }: AppTextProps) {
  const colors = useColors();
  const base = variant === 'caption' || variant === 'scientific' ? colors.sub : colors.ink;

  return (
    <Text
      // 한글이 단어 중간에서 줄바꿈되지 않게 한다 (iOS 기본은 글자 단위)
      lineBreakStrategyIOS="hangul-word"
      {...rest}
      style={[typography[variant], { color: color ?? base }, style]}>
      {keepWords(children)}
    </Text>
  );
}
