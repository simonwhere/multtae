import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

export interface CardProps {
  children: React.ReactNode;
  /** 있으면 카드 전체가 눌린다 */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 여럿 중 고른 카드. 테두리가 주색으로 바뀐다 */
  selected?: boolean;
  /** highlight: 새순 연두의 강조 면. 오늘 물 줄 카드와 다음 물주기 카드에 쓴다 */
  tone?: 'surface' | 'highlight';
  style?: StyleProp<ViewStyle>;
}

// 14.4: 모서리 20pt, 그림자 없음, 흰 면에 아주 옅은 1px 선. 강조 면은 선 없이 면만 쓴다
export function Card({
  children,
  onPress,
  accessibilityLabel,
  selected = false,
  tone = 'surface',
  style,
}: CardProps) {
  const colors = useColors();
  const highlighted = tone === 'highlight';
  const face = [
    styles.card,
    {
      backgroundColor: highlighted ? colors.highlight : colors.surface,
      borderColor: selected ? colors.accent : highlighted ? colors.highlight : colors.hair,
      borderWidth: selected ? 1.5 : 1,
      // 테두리가 굵어져도 안쪽 내용이 움직이지 않게 한다
      padding: spacing.lg - (selected ? 0.5 : 0),
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
