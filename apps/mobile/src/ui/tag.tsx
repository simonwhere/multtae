import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

export type TagTone = 'highlight' | 'soft' | 'surface' | 'berry';

/** 식물 가게의 이름표에서 가져온 작은 표: "오늘", "D-3", "3일 지남", 식물군, 공간 (SPEC 14.4) */
export function Tag({ label, tone = 'soft' }: { label: string; tone?: TagTone }) {
  const colors = useColors();
  const face = {
    highlight: colors.highlight,
    soft: colors.soft,
    surface: colors.surface,
    berry: colors.berryTint,
  }[tone];

  return (
    <View style={[styles.tag, { backgroundColor: face }]}>
      <AppText variant="tag" numberOfLines={1} color={tone === 'berry' ? colors.berry : colors.ink}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: radius.tag,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
});
