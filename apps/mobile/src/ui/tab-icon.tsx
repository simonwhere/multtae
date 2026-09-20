import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** 하단 탭 아이콘. 14.4: 선 1.5pt 단색 */
export type TabIconName = 'today' | 'spaces' | 'plants' | 'records';

const PATHS: Record<TabIconName, string> = {
  // 달력의 하루
  today: 'M4 6.5h16v13H4z M4 10h16 M8 4v4 M16 4v4',
  // 창
  spaces: 'M5 4h14v16H5z M12 4v16 M5 12h14',
  // 화분
  plants: 'M6 11h12l-1.5 9h-9z M12 11V6 M12 8c0-2 1.5-3.5 4-3.5 M12 9c0-1.6-1.2-2.8-3.2-2.8',
  // 목록
  records: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.5 M4 12h.5 M4 18h.5',
};

export function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: TabIconName;
  color: ColorValue;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
