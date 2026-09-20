import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

/** 경고·안내 상자. 글자는 읽기 쉬운 글자색으로 두고 경고색은 테두리에만 쓴다 */
export function Notice({ message }: { message: string }) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.warn }]}>
      <AppText>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
  },
});
