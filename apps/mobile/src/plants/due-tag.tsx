import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SoilGaugeState } from '@/engine';
import { ko } from '@/i18n/ko';
import { AppText, spacing, Tag, useColors } from '@/ui';

import { formatDaysLeft } from './format';

export interface DueTagProps {
  soil: Pick<SoilGaugeState, 'status' | 'daysLeft'>;
  /** 오늘 물을 줬다. 체크 표시와 "완료" 글자로 말한다 (색만으로 구분하지 않는다, SPEC 15) */
  done?: boolean;
  /** 강조 면 위에 놓였다 */
  onHighlight?: boolean;
}

/** 다음 물주기까지 남은 날을 이름표로: "오늘", "D-3", "3일 지남", 그리고 완료 (SPEC 14.4) */
export function DueTag({ soil, done = false, onHighlight = false }: DueTagProps) {
  const colors = useColors();

  if (done) {
    return (
      <View style={styles.done}>
        <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <AppText variant="tag" color={colors.accent}>
          {ko.today.doneBadge}
        </AppText>
      </View>
    );
  }

  // 강조 면 위에서는 옅은 이름표가 묻히므로 카드 면 색으로 그린다
  const tone =
    soil.status === 'overdue'
      ? 'berry'
      : onHighlight
        ? 'surface'
        : soil.status === 'due'
          ? 'highlight'
          : 'soft';
  return <Tag label={formatDaysLeft(soil.daysLeft)} tone={tone} />;
}

const styles = StyleSheet.create({
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
