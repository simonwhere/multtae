import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ko } from '@/i18n/ko';
import { AppText, radius, spacing, useColors } from '@/ui';

const ACTION_WIDTH = 104;

export interface SwipeRowProps {
  onWatered: () => void;
  /** 없으면 더 미룰 수 없다 */
  onPostpone?: () => void;
  children: React.ReactNode;
}

/**
 * 오늘 섹션 카드의 스와이프 (SPEC 3.2): 오른쪽으로 밀면 "물 줬어요", 왼쪽으로 밀면 "내일로".
 * 같은 동작이 카드의 버튼으로도 있어서 스와이프를 못 써도 된다 (SPEC 15).
 */
export function SwipeRow({ onWatered, onPostpone, children }: SwipeRowProps) {
  const colors = useColors();
  const row = useRef<SwipeableMethods>(null);

  const run = (action: () => void) => {
    row.current?.close();
    action();
  };

  return (
    <ReanimatedSwipeable
      ref={row}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ko.action.watered}
          onPress={() => run(onWatered)}
          style={[styles.action, styles.left, { backgroundColor: colors.accent }]}>
          <AppText variant="label" color={colors.onAccent}>
            {ko.action.watered}
          </AppText>
        </Pressable>
      )}
      renderRightActions={
        onPostpone
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ko.action.postpone}
                onPress={() => run(onPostpone)}
                style={[
                  styles.action,
                  styles.right,
                  { backgroundColor: colors.soft, borderColor: colors.soft },
                ]}>
                <AppText>{ko.action.postpone}</AppText>
              </Pressable>
            )
          : undefined
      }>
      <View>{children}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  left: {
    marginRight: spacing.sm,
  },
  right: {
    marginLeft: spacing.sm,
    borderWidth: 1,
  },
});
