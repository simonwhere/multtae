import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

export interface CardProps {
  children: React.ReactNode;
  /** 있으면 카드 전체가 눌린다 */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// 14.4: 모서리 12pt, 그림자 없음, paper 보다 한 단계 밝은 면색, 1px 흙색 테두리
export function Card({ children, onPress, accessibilityLabel, style }: CardProps) {
  const colors = useColors();
  const face = [styles.card, { backgroundColor: colors.surface, borderColor: colors.soil.dry }];

  if (!onPress) {
    return <View style={[face, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [face, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
});
