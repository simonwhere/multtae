import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import { useGarden } from '@/plants/use-plants';
import { SpaceCard } from '@/spaces/space-card';
import { AppText, spacing, useColors } from '@/ui';

// 공간 탭 (SPEC 3.3). 카드를 누르면 공간 상세로 간다.
export default function SpacesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { garden } = useGarden();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.spacesTab.title}
      </AppText>
      {garden === null ? null : garden.spaces.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.spacesTab.empty}</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {garden.spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              plantCount={garden.plants.filter((item) => item.space.id === space.id).length}
              onPress={() => router.push({ pathname: '/space/[id]', params: { id: space.id } })}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingTop: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
});
