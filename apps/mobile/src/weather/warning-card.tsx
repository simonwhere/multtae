import { StyleSheet, View } from 'react-native';

import { ko } from '@/i18n/ko';
import { AppText, radius, spacing, TextButton, useColors } from '@/ui';

import type { CardText } from './card-text';

/**
 * 오늘 탭 경고 카드 (SPEC 3.2). 제목 이름표로 무슨 카드인지 말하고, 색은 거들기만 한다 (CLAUDE.md 색 규칙).
 * 닫으면 그날은 다시 뜨지 않는다.
 */
export function WarningCard({ card, onClose }: { card: CardText; onClose: () => void }) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.card,
        { backgroundColor: card.tone === 'warning' ? colors.berryTint : colors.highlight },
      ]}>
      <View style={styles.top}>
        <AppText variant="label" style={styles.title}>
          {card.title}
        </AppText>
        <TextButton
          label={ko.cards.close}
          accessibilityLabel={ko.cards.closeLabel(card.title)}
          onPress={onClose}
        />
      </View>
      <AppText>{card.body}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
});
