import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './app-text';
import { spacing } from './tokens';
import { useColors } from './use-colors';

export interface TextButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** berry: 삭제처럼 되돌릴 수 없는 동작 */
  tone?: 'accent' | 'berry';
}

/** 면 없이 글자만 있는 보조 동작 (닫기, 수정) */
export function TextButton({ label, onPress, disabled = false, tone = 'accent' }: TextButtonProps) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}>
      <AppText variant="label" color={tone === 'berry' ? colors.berry : colors.accent}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.5,
  },
});
