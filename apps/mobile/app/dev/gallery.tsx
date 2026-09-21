import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SoilStatus } from '@/engine/soil';
import { ko } from '@/i18n/ko';
import { AppText, Button, Card, DayGauge, spacing, Sprig, Tag, useColors } from '@/ui';

// 개발용 컴포넌트 갤러리 (/dev/gallery). 배포 빌드에서는 홈으로 돌려보낸다.
// 구역 이름은 개발자만 보므로 영어로 두고, 한국어 예시는 ko.ts 의 실제 문구를 쓴다.

const GAUGE_SAMPLES: { label: string; status: SoilStatus; moisture: number; totalDays: number }[] = [
  { label: '7 / 7', status: 'moist', moisture: 1, totalDays: 7 },
  { label: '4 / 7', status: 'moist', moisture: 4 / 7, totalDays: 7 },
  { label: '1 / 2', status: 'moist', moisture: 0.5, totalDays: 2 },
  { label: '20 / 35', status: 'moist', moisture: 20 / 35, totalDays: 35 },
  { label: 'due', status: 'due', moisture: 0, totalDays: 7 },
  { label: 'overdue', status: 'overdue', moisture: 0, totalDays: 9 },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption">{title}</AppText>
      {children}
    </View>
  );
}

export default function GalleryScreen() {
  const colors = useColors();
  const [watered, setWatered] = useState(false);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const swatches: [string, string][] = [
    ['ink', colors.ink],
    ['sub', colors.sub],
    ['paper', colors.paper],
    ['surface', colors.surface],
    ['hair', colors.hair],
    ['soft', colors.soft],
    ['block', colors.block],
    ['accent', colors.accent],
    ['highlight', colors.highlight],
    ['gaugeEmpty', colors.gaugeEmpty],
    ['berry', colors.berry],
    ['berryTint', colors.berryTint],
    ['berryEmpty', colors.berryEmpty],
    ['sprig', colors.sprig],
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="TYPE 14.3">
          <AppText variant="numeralLg">9.21</AppText>
          <AppText variant="numeralMd">9.28</AppText>
          <AppText variant="numeralSm">12</AppText>
          <AppText variant="titleLg">{ko.today.title}</AppText>
          <AppText variant="titleSm">{ko.app.name}</AppText>
          <AppText>{ko.today.empty}</AppText>
          <AppText variant="scientific">Monstera deliciosa</AppText>
          <AppText variant="label">{ko.today.due}</AppText>
          <AppText variant="caption">{ko.today.nextWater(ko.format.monthDay(9, 28))}</AppText>
          <View style={styles.row}>
            <Tag label="D-3" />
            <Tag label={ko.format.dDay(0)} tone="highlight" />
            <Tag label={ko.format.overdue(3)} tone="berry" />
            <Sprig size={48} />
          </View>
        </Section>

        <Section title="COLOR 14.2">
          <View style={styles.swatches}>
            {swatches.map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View
                  style={[styles.chip, { backgroundColor: value, borderColor: colors.hair }]}
                />
                <AppText variant="caption">{name}</AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="DAY GAUGE 14.1">
          <Card style={styles.stack}>
            {GAUGE_SAMPLES.map((sample) => (
              <View key={sample.label} style={styles.row}>
                <AppText variant="caption" style={styles.rowLabel}>
                  {sample.label}
                </AppText>
                <DayGauge
                  status={sample.status}
                  moisture={sample.moisture}
                  totalDays={sample.totalDays}
                  style={styles.fill}
                />
              </View>
            ))}
          </Card>
        </Section>

        <Section title="CARD + BUTTON 14.4">
          <Card tone={watered ? 'surface' : 'highlight'} style={styles.stack}>
            <View style={styles.cardHeader}>
              <View style={styles.fill}>
                <AppText variant="titleSm">{ko.app.name}</AppText>
                <AppText variant="scientific">Pinus thunbergii</AppText>
              </View>
              <Tag
                label={ko.format.dDay(watered ? 7 : 0)}
                tone={watered ? 'soft' : 'surface'}
              />
            </View>
            {/* key 가 바뀌면 새로 그려져서 빈 데서부터 차는 모습을 다시 본다 */}
            <DayGauge
              key={String(watered)}
              status={watered ? 'moist' : 'due'}
              moisture={watered ? 1 : 0}
              totalDays={7}
              onHighlight={!watered}
              animateFill={watered}
            />
            <View style={styles.actions}>
              <Button
                label={ko.action.watered}
                onPress={() => setWatered(true)}
                disabled={watered}
                style={styles.fill}
              />
              <Button
                label={ko.action.postpone}
                variant={watered ? 'secondary' : 'surface'}
                onPress={() => setWatered(false)}
                style={styles.fill}
              />
            </View>
          </Card>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 64,
  },
  chip: {
    width: 48,
    height: 32,
    borderRadius: spacing.sm,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    width: 72,
  },
  fill: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
