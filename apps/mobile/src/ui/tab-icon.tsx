import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** 하단 탭 아이콘과 같은 결의 선 아이콘. 14.4: 선 1.5pt 단색 */
export type TabIconName = 'today' | 'spaces' | 'plants' | 'records' | 'settings';

const PATHS: Record<TabIconName, string> = {
  // 달력의 하루
  today: 'M4 6.5h16v13H4z M4 10h16 M8 4v4 M16 4v4',
  // 창
  spaces: 'M5 4h14v16H5z M12 4v16 M5 12h14',
  // 화분
  plants: 'M6 11h12l-1.5 9h-9z M12 11V6 M12 8c0-2 1.5-3.5 4-3.5 M12 9c0-1.6-1.2-2.8-3.2-2.8',
  // 목록
  records: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.5 M4 12h.5 M4 18h.5',
  // 조절 막대. 해 모양 톱니는 날씨 아이콘과 헷갈려서 쓰지 않는다
  settings: 'M4 7h9 M17 7h3 M15 5v4 M4 17h3 M11 17h9 M9 15v4',
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
