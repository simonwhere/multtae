import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

/** 경고·안내 상자. 옅은 자줏빛 면에 읽기 쉬운 글자색으로 쓴다 */
export function Notice({ message }: { message: string }) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: colors.berryTint }]}>
      <AppText>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radius.control,
    padding: spacing.lg,
  },
});
