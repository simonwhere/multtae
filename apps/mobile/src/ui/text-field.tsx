import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing, typography } from './tokens';
import { useColors } from './use-colors';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, ...input }: TextFieldProps) {
  const colors = useColors();

  return (
    <View style={styles.field}>
      <AppText variant="formula">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.soil.crack}
        selectionColor={colors.water}
        {...input}
        style={[
          typography.body,
          styles.input,
          { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.soil.dry },
        ]}
      />
      {hint ? <AppText variant="formula">{hint}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // 행간 토큰은 여러 줄 본문용이라 한 줄 입력에서는 글자가 위로 붙는다
    lineHeight: undefined,
  },
});
