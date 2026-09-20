import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { listPlantsWithSpace } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import type { Space } from '@/db/schema';
import { listSpaces } from '@/db/spaces';
import { ko } from '@/i18n/ko';
import { PlantCard } from '@/plants/plant-card';
import { MAX_PLANTS } from '@/plants/registration';
import { MAX_SPACES } from '@/spaces/registration';
import { SpaceCard } from '@/spaces/space-card';
import { AppText, Button, Notice, spacing, useColors } from '@/ui';

interface HomeData {
  spaces: Space[];
  plants: PlantWithSpace[];
  /** 목록의 모든 카드가 같은 "오늘"을 보도록 읽은 시각을 함께 둔다 */
  loadedAt: number;
}

// 오늘 탭 (SPEC 3.2). 밀림·오늘·다가옴 구분과 "물 줬어요"는 2-3 에서 채운다.
// 공간 탭·식물 탭이 생기기 전까지는 등록한 식물과 공간을 여기서 보여 준다.
export default function TodayScreen() {
  const colors = useColors();
  const router = useRouter();
  /** null 은 불러오는 중 */
  const [data, setData] = useState<HomeData | null>(null);

  // 등록 모달에서 돌아올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([listSpaces(db), listPlantsWithSpace(db)]).then(([spaces, plants]) => {
        if (alive) setData({ spaces, plants, loadedAt: Date.now() });
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const registerSpace = () => router.push('/register/space');
  const registerPlant = () => router.push('/register/plant');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.today.title}
      </AppText>
      {data === null ? null : data.spaces.length === 0 ? (
        // 공간을 먼저 등록하고 식물을 놓는다 (SPEC 1)
        <View style={styles.empty}>
          <AppText>{ko.today.empty}</AppText>
          <Button label={ko.today.registerSpace} onPress={registerSpace} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {data.plants.length === 0 ? <AppText>{ko.today.noPlants}</AppText> : null}
          {data.plants.length > 0 ? <AppText variant="formula">{ko.today.plants}</AppText> : null}
          {data.plants.map((item) => (
            <PlantCard
              key={item.plant.id}
              plant={item.plant}
              space={item.space}
              now={data.loadedAt}
              utcOffsetMinutes={-new Date(data.loadedAt).getTimezoneOffset()}
            />
          ))}
          {data.plants.length >= MAX_PLANTS ? (
            <Notice message={ko.today.plantLimit} />
          ) : (
            <Button label={ko.today.registerPlant} onPress={registerPlant} />
          )}

          <AppText variant="formula" style={styles.sectionGap}>
            {ko.today.spaces}
          </AppText>
          {data.spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
          {data.spaces.length >= MAX_SPACES ? (
            <Notice message={ko.today.spaceLimit} />
          ) : (
            <Button label={ko.today.addSpace} variant="secondary" onPress={registerSpace} />
          )}
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
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  sectionGap: {
    marginTop: spacing.lg,
  },
});
