import { useColorScheme } from 'react-native';

import { colors } from './tokens';
import type { ColorTokens } from './tokens';

/** 기기 라이트·다크 설정에 맞는 색 토큰 */
export function useColors(): ColorTokens {
  return colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
