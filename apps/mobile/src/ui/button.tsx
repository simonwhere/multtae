import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary: 주색 면, secondary: 옅은 면, surface: 카드 면(강조 면 위에 놓는 보조 버튼).
   * 테두리는 쓰지 않는다 (SPEC 14.4)
   */
  variant?: 'primary' | 'secondary' | 'surface';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, style }: ButtonProps) {
  const colors = useColors();
  const primary = variant === 'primary';
  const face = {
    backgroundColor: primary ? colors.accent : variant === 'surface' ? colors.surface : colors.soft,
  };

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
      <AppText variant="label" color={primary ? colors.onAccent : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // 글자가 커져도 잘리지 않게 높이는 최소값만 둔다 (SPEC 15 동적 글자 크기)
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
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
