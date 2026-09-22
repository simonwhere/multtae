import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

/**
 * 누르는 작은 이름표 (기록 탭의 보기·식물 고르기). 고른 것은 강조 면에 테두리를 두르고
 * 스크린리더에는 선택됨으로 알린다. 색만으로 구분하지 않는다 (SPEC 15)
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.highlight, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.hair },
        pressed && styles.pressed,
      ]}>
      <AppText variant="label" numberOfLines={1} color={selected ? colors.ink : colors.sub}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
