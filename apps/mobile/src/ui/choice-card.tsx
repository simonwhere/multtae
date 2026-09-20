import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import type { TypographyToken } from './tokens';
import { useColors } from './use-colors';

export interface ChoiceCardProps {
  label: string;
  hint?: string;
  /** 설명 글의 서체. 학명은 scientific */
  hintVariant?: TypographyToken;
  /** 글자 앞에 두는 작은 그림 */
  leading?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  /** 글자를 가운데에 둔다 (방향처럼 짧은 선택지) */
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 여럿 중 하나를 고르는 카드. 고른 것은 테두리 굵기와 체크 표시로도 구분한다 (SPEC 15) */
export function ChoiceCard({
  label,
  hint,
  hintVariant = 'formula',
  leading,
  selected,
  onPress,
  centered = false,
  style,
}: ChoiceCardProps) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.ink : colors.soil.dry,
          borderWidth: selected ? 2 : 1,
          // 테두리가 굵어져도 안쪽 내용이 움직이지 않게 한다
          padding: spacing.lg - (selected ? 1 : 0),
        },
        centered && styles.centered,
        pressed && styles.pressed,
        style,
      ]}>
      {leading}
      <View style={centered ? undefined : styles.text}>
        <AppText variant={centered ? 'titleSm' : 'body'}>{label}</AppText>
        {hint ? <AppText variant={hintVariant}>{hint}</AppText> : null}
      </View>
      {selected && !centered ? (
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Path
            d="M4 10.5 L8.5 15 L16 6"
            stroke={colors.ink}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
  },
  centered: {
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
