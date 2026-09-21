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
      <AppText variant="caption" color={colors.sub}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.sub}
        selectionColor={colors.accent}
        {...input}
        style={[
          typography.body,
          styles.input,
          { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.hair },
        ]}
      />
      {hint ? (
        <AppText variant="caption" color={colors.sub}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // 행간 토큰은 여러 줄 본문용이라 한 줄 입력에서는 글자가 위로 붙는다
    lineHeight: undefined,
  },
});
