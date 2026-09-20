import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary: 글자색 면에 배경색 글자, secondary: 카드 면에 흙색 테두리 */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, style }: ButtonProps) {
  const colors = useColors();
  const primary = variant === 'primary';
  const face = primary
    ? { backgroundColor: colors.ink, borderColor: colors.ink }
    : { backgroundColor: colors.surface, borderColor: colors.soil.dry };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        face,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <AppText color={primary ? colors.paper : colors.ink}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // 글자가 커져도 잘리지 않게 높이는 최소값만 둔다 (SPEC 15 동적 글자 크기)
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});
