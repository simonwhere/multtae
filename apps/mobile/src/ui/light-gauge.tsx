import { StyleSheet, View } from 'react-native';

import { LIGHT_GRADES } from '@/engine/types';
import type { LightGrade } from '@/engine/types';
import { ko } from '@/i18n/ko';

import { spacing } from './tokens';
import { useColors } from './use-colors';

/** 빛 등급 4칸 게이지 (SPEC 14.5). 저광 1칸부터 강광 4칸까지 찬다 */
export function LightGauge({ grade }: { grade: LightGrade }) {
  const colors = useColors();
  // LIGHT_GRADES 는 강광부터라 뒤집어 센다
  const filled = LIGHT_GRADES.length - LIGHT_GRADES.indexOf(grade);

  return (
    <View accessible accessibilityLabel={ko.lightGrade[grade]} style={styles.gauge}>
      {LIGHT_GRADES.map((_, index) => (
        <View
          key={index}
          style={[
            styles.cell,
            {
              borderColor: index < filled ? colors.accent : colors.gaugeEmpty,
              backgroundColor: index < filled ? colors.accent : colors.gaugeEmpty,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cell: {
    width: 28,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
});
