import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './app-text';
import { spacing } from './tokens';

export interface TextButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** 면 없이 글자만 있는 보조 동작 (닫기, 수정) */
export function TextButton({ label, onPress, disabled = false }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    justifyContent: 'center',
  },
  label: {
    textDecorationLine: 'underline',
  },
  dimmed: {
    opacity: 0.5,
  },
});
