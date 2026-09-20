import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

export interface CardProps {
  children: React.ReactNode;
  /** 있으면 카드 전체가 눌린다 */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 여럿 중 고른 카드. 테두리가 글자색으로 굵어진다 */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

// 14.4: 모서리 12pt, 그림자 없음, paper 보다 한 단계 밝은 면색, 1px 흙색 테두리
export function Card({
  children,
  onPress,
  accessibilityLabel,
  selected = false,
  style,
}: CardProps) {
  const colors = useColors();
  const face = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: selected ? colors.ink : colors.soil.dry,
      borderWidth: selected ? 2 : 1,
      // 테두리가 굵어져도 안쪽 내용이 움직이지 않게 한다
      padding: spacing.lg - (selected ? 1 : 0),
    },
  ];

  if (!onPress) {
    return <View style={[face, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
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
  },
  pressed: {
    opacity: 0.85,
  },
});
