import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { Fab, spacing, TabIcon, typography, useColors } from '@/ui';
import type { TabIconName } from '@/ui';

const TAB_BAR_HEIGHT = 56;

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: ko.tabs.today, icon: 'today' },
  { name: 'spaces', title: ko.tabs.spaces, icon: 'spaces' },
  { name: 'plants', title: ko.tabs.plants, icon: 'plants' },
  { name: 'records', title: ko.tabs.records, icon: 'records' },
];

// 하단 탭 4개와 우하단 + 버튼 (SPEC 3)
export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.fill}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.paper },
          tabBarActiveTintColor: colors.ink,
          // 고르지 않은 탭은 같은 글자색을 흐리게. 고른 탭은 위의 막대로도 구분한다 (SPEC 15)
          tabBarInactiveTintColor: `${colors.ink}80`,
          tabBarLabelStyle: { fontFamily: typography.formula.fontFamily, fontSize: 11 },
          tabBarStyle: {
            height: TAB_BAR_HEIGHT + insets.bottom,
            backgroundColor: colors.surface,
            borderTopColor: colors.soil.dry,
            borderTopWidth: 1,
          },
        }}>
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.icon}>
                  <View
                    style={[
                      styles.indicator,
                      { backgroundColor: colors.ink, opacity: focused ? 1 : 0 },
                    ]}
                  />
                  <TabIcon name={tab.icon} color={color} />
                </View>
              ),
            }}
          />
        ))}
      </Tabs>
      <Fab
        accessibilityLabel={ko.tabs.add}
        bottom={TAB_BAR_HEIGHT + insets.bottom + spacing.lg}
        onPress={() => router.push('/sheet/register')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  icon: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});
