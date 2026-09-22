import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { listRecentWaterings } from '@/db/watering';
import type { WateringWithPlant } from '@/db/watering';
import { toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { formatMonthDay } from '@/plants/format';
import { AppText, Card, spacing, useColors } from '@/ui';

const RECENT = 50;

// 기록 탭 (SPEC 3.5). 지금은 최근 물주기만 보여 준다. 타임라인·통계는 5-4 에서 채운다.
export default function RecordsScreen() {
  const colors = useColors();
  const [records, setRecords] = useState<WateringWithPlant[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void listRecentWaterings(db, RECENT).then(setRecords);
    }, []),
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <AppText variant="titleLg" accessibilityRole="header">
        {ko.records.title}
      </AppText>
      {records === null ? null : records.length === 0 ? (
        <View style={styles.empty}>
          <AppText>{ko.records.empty}</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {records.map(({ log, nickname }) => (
            <Card key={log.id} style={styles.record}>
              <View style={styles.recordTop}>
                <AppText variant="titleSm" style={styles.fill} numberOfLines={1}>
                  {nickname}
                </AppText>
                <AppText variant="caption">
                  {formatMonthDay(
                    toCalendarDate(log.wateredAt, -new Date(log.wateredAt).getTimezoneOffset()),
                  )}
                </AppText>
              </View>
              <AppText variant="caption">
                {[
                  log.source === 'rain' ? ko.records.rain : ko.records.watered,
                  ko.records.soilState[log.soilState],
                  log.leafDroop ? ko.wateredSheet.leafDroop : '',
                ]
                  .filter((text) => text !== '')
                  .join(', ')}
              </AppText>
            </Card>
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
  record: {
    gap: spacing.xs,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fill: {
    flex: 1,
  },
});
