import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColors } from './use-colors';

const SIZE = 60;

/** 우하단 + 버튼. 어느 탭에서든 등록으로 들어간다 (SPEC 3) */
export function Fab({
  accessibilityLabel,
  onPress,
  bottom,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  bottom: number;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom, backgroundColor: colors.accent, shadowColor: colors.ink },
        pressed && styles.pressed,
      ]}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M12 5v14 M5 12h14" stroke={colors.onAccent} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: SIZE,
    height: SIZE,
    // 시안의 둥근 네모. 앱에서 그림자를 쓰는 곳은 여기뿐이다
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
