import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Condition } from './forecast';

/** 오늘 탭 날씨 아이콘 (SPEC 3.2). 탭 아이콘과 같은 선 1.5pt 단색 (14.4) */
const CLOUD = 'M7 18h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.7 1.2A3 3 0 0 0 7 18z';

const PATHS: Record<Condition, string> = {
  clear:
    'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M12 3.5v2 M12 18.5v2 M3.5 12h2 M18.5 12h2 M6 6l1.4 1.4 M16.6 16.6L18 18 M6 18l1.4-1.4 M16.6 7.4L18 6',
  // 구름 뒤로 해가 조금 보인다
  cloudy: `${CLOUD} M8.5 7.5a3 3 0 0 1 4.3-2.2 M9.5 3.5v.8 M4.8 6.3l.6.6`,
  overcast: CLOUD,
  rain: 'M7 15h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.7 1.2A3 3 0 0 0 7 15z M9 18l-1 2 M13 18l-1 2 M17 18l-1 2',
  snow: 'M7 15h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.7 1.2A3 3 0 0 0 7 15z M9 19h.01 M13 20h.01 M17 19h.01',
};

export function WeatherIcon({
  condition,
  color,
  size = 20,
}: {
  condition: Condition;
  color: ColorValue;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d={PATHS[condition]}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
