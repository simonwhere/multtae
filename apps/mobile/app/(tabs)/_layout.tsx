import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { Fab, spacing, TabIcon, typography, useColors } from '@/ui';
import type { TabIconName } from '@/ui';

const TAB_BAR_HEIGHT = 64;

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
          // 고른 탭은 주색 글자에 새순 연두 알약으로도 구분한다 (SPEC 15)
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.sub,
          tabBarActiveBackgroundColor: colors.highlight,
          tabBarLabelStyle: { fontFamily: typography.tag.fontFamily, fontSize: 12 },
          tabBarItemStyle: styles.item,
          tabBarStyle: {
            height: TAB_BAR_HEIGHT + insets.bottom,
            backgroundColor: colors.surface,
            borderTopColor: colors.hair,
            borderTopWidth: 1,
            paddingTop: spacing.sm,
            paddingHorizontal: spacing.md,
          },
        }}>
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={color} />,
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
  item: {
    borderRadius: 16,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
});
