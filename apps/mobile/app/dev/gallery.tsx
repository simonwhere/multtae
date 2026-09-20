import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SoilStatus } from '@/engine/soil';
import { ko } from '@/i18n/ko';
import { AppText, Button, Card, SoilGauge, spacing, useColors } from '@/ui';

// 개발용 컴포넌트 갤러리 (/dev/gallery). 배포 빌드에서는 홈으로 돌려보낸다.
// 구역 이름은 개발자만 보므로 영어로 두고, 한국어 예시는 ko.ts 의 실제 문구를 쓴다.

const GAUGE_SAMPLES: { label: string; status: SoilStatus; moisture: number }[] = [
  { label: 'moist 1.0', status: 'moist', moisture: 1 },
  { label: 'moist 0.6', status: 'moist', moisture: 0.6 },
  { label: 'moist 0.2', status: 'moist', moisture: 0.2 },
  { label: 'due', status: 'due', moisture: 0 },
  { label: 'overdue', status: 'overdue', moisture: 0 },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="formula">{title}</AppText>
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
    ['paper', colors.paper],
    ['surface', colors.surface],
    ['soil.wet', colors.soil.wet],
    ['soil.dry', colors.soil.dry],
    ['soil.crack', colors.soil.crack],
    ['moss', colors.moss],
    ['water', colors.water],
    ['warn', colors.warn],
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="TYPE 14.3">
          <AppText variant="numeralLg">D-3</AppText>
          <AppText variant="numeralSm">12</AppText>
          <AppText variant="titleLg">{ko.today.title}</AppText>
          <AppText variant="titleSm">{ko.app.name}</AppText>
          <AppText>{ko.today.empty}</AppText>
          <AppText variant="scientific">Monstera deliciosa</AppText>
          <AppText variant="formula">7 × 1.0 × 1.0 × 1.3 × 1.0 × 1.0 × 1.15 = 10</AppText>
        </Section>

        <Section title="COLOR 14.2">
          <View style={styles.swatches}>
            {swatches.map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View
                  style={[styles.chip, { backgroundColor: value, borderColor: colors.soil.dry }]}
                />
                <AppText variant="formula">{name}</AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="SOIL GAUGE 14.1 band">
          <Card style={styles.stack}>
            {GAUGE_SAMPLES.map((sample) => (
              <View key={sample.label} style={styles.row}>
                <AppText variant="formula" style={styles.rowLabel}>
                  {sample.label}
                </AppText>
                <SoilGauge status={sample.status} moisture={sample.moisture} style={styles.fill} />
              </View>
            ))}
          </Card>
        </Section>

        <Section title="SOIL GAUGE 14.1 pot (bonsai)">
          <Card style={styles.stack}>
            {GAUGE_SAMPLES.map((sample) => (
              <View key={sample.label} style={styles.row}>
                <AppText variant="formula" style={styles.rowLabel}>
                  {sample.label}
                </AppText>
                <SoilGauge
                  variant="pot"
                  status={sample.status}
                  moisture={sample.moisture}
                  style={styles.fill}
                />
              </View>
            ))}
          </Card>
        </Section>

        <Section title="CARD + BUTTON 14.4">
          <Card style={styles.stack}>
            <View style={styles.cardHeader}>
              <View style={styles.fill}>
                <AppText variant="titleSm">{ko.app.name}</AppText>
                <AppText variant="scientific">Pinus thunbergii</AppText>
              </View>
              <AppText variant="numeralSm" color={watered ? colors.moss : colors.water}>
                {watered ? 'D-7' : 'D-0'}
              </AppText>
            </View>
            <SoilGauge status={watered ? 'moist' : 'due'} moisture={watered ? 1 : 0} />
            <View style={styles.actions}>
              <Button
                label={ko.action.watered}
                onPress={() => setWatered(true)}
                disabled={watered}
                style={styles.fill}
              />
              <Button
                label={ko.action.postpone}
                variant="secondary"
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
