import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { deleteSetting, getSetting, setSetting } from '@/db/settings';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { findRegion, REGIONS, searchRegions, SIDOS } from '@/weather/regions';
import type { Region } from '@/weather/regions';
import { syncWeather } from '@/weather/sync';
import { AppText, ChoiceCard, spacing, TextButton, TextField } from '@/ui';

// 날씨 지역 고르기 (SPEC 3.6). 시·도를 누르고 시·군·구를 고르거나, 이름으로 찾는다.
// 목록이 길어 스크롤되는 모달로 띄운다 (app/_layout.tsx).
export default function RegionSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<string | null>(null);
  const [sido, setSido] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void getSetting(db, 'region_code').then((id) => {
      setCurrent(id);
      setSido(findRegion(id)?.sido ?? null);
    });
  }, []);

  const t = ko.regionSheet;

  async function choose(region: Region | null) {
    if (region) await setSetting(db, 'region_code', region.id);
    else await deleteSetting(db, 'region_code');
    // 지역이 바뀌었으니 3시간을 기다리지 않고 바로 받는다
    void syncWeather(true);
    rescheduleSoon();
    router.back();
  }

  const results = query.trim() === '' ? null : searchRegions(query);
  const inSido = sido ? REGIONS.filter((region) => region.sido === sido) : [];

  const regionCard = (region: Region) => (
    <ChoiceCard
      key={region.id}
      label={results ? region.id : region.name}
      selected={current === region.id}
      onPress={() => void choose(region)}
    />
  );

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <AppText variant="titleSm" accessibilityRole="header">
        {t.title}
      </AppText>
      <TextField
        label={t.search}
        placeholder={t.searchPlaceholder}
        returnKeyType="search"
        value={query}
        onChangeText={setQuery}
      />

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled">
        {results ? (
          results.length === 0 ? (
            <AppText>{t.noResult}</AppText>
          ) : (
            results.map(regionCard)
          )
        ) : sido ? (
          <>
            <View style={styles.start}>
              <TextButton label={t.sidoBack} onPress={() => setSido(null)} />
            </View>
            {inSido.map(regionCard)}
          </>
        ) : (
          <>
            <View style={styles.grid}>
              {SIDOS.map((name) => (
                <ChoiceCard
                  key={name}
                  centered
                  label={name}
                  selected={findRegion(current)?.sido === name}
                  onPress={() => setSido(name)}
                  style={styles.third}
                />
              ))}
            </View>
            <ChoiceCard
              label={t.none}
              hint={t.noneHint}
              selected={current === null}
              onPress={() => void choose(null)}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  fill: {
    flex: 1,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  // 세 칸씩. 마지막 줄이 모자라도 왼쪽부터 채운다
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  third: {
    width: '31.6%',
  },
  start: {
    alignItems: 'flex-start',
  },
});
