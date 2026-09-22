import { Pressable, StyleSheet, View } from 'react-native';

import { ko } from '../i18n/ko';
import { Chevron } from './chevron';
import { radius, spacing } from './tokens';
import { useColors } from './use-colors';

/** 상세 화면 왼쪽 위의 뒤로 가기. 꺾쇠를 돌려 쓴다 */
export function BackButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ko.common.goBack}
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [
        styles.back,
        { backgroundColor: colors.surface, borderColor: colors.hair },
        pressed && styles.pressed,
      ]}>
      <View style={styles.icon}>
        <Chevron />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
  },
  icon: {
    transform: [{ rotate: '180deg' }],
  },
  pressed: {
    opacity: 0.6,
  },
});
