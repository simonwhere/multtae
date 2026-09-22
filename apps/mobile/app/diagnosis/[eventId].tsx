import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { getEvent } from '@/db/events';
import type { EventWithPlant } from '@/db/events';
import { likelihoodOf, parseDiagnosis } from '@/diagnose/diagnosis';
import { toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { photoUri } from '@/photos/photo-store';
import { formatMonthDay } from '@/plants/format';
import { nowContext } from '@/plants/use-now';
import { AppText, BackButton, Card, Notice, radius, spacing, Tag, useColors } from '@/ui';

// 진단 결과 (SPEC 8.1, 9.3): 의심되는 것(가능성), 까닭, 지금 할 일 3개, 다시 볼 날, 면책 문구.
// 심각하면 위에 "빨리 손써 주세요"를 둔다. 기록 탭에서 다시 열 수 있다.
export default function DiagnosisScreen() {
  const colors = useColors();
  const router = useRouter();
  const { eventId, remaining } = useLocalSearchParams<{ eventId: string; remaining?: string }>();
  const [record, setRecord] = useState<EventWithPlant | 'missing' | null>(null);

  useEffect(() => {
    void getEvent(db, eventId).then((found) => setRecord(found ?? 'missing'));
  }, [eventId]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const diagnosis = record && record !== 'missing' ? parseDiagnosis(record.event.payload) : null;
  const t = ko.diagnosis;

  if (!record || record === 'missing' || !diagnosis) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
        <View style={styles.header}>
          <BackButton onPress={close} />
        </View>
        {record ? (
          <View style={styles.center}>
            <AppText>{t.missing}</AppText>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const { event, nickname } = record;
  const { utcOffsetMinutes } = nowContext();
  const left = remaining === undefined ? null : Number(remaining);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <BackButton onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.names}>
          <AppText variant="titleLg" accessibilityRole="header">
            {t.title}
          </AppText>
          <View style={styles.tags}>
            <Tag label={nickname} tone="highlight" />
            <Tag label={formatMonthDay(toCalendarDate(event.occurredAt, utcOffsetMinutes))} />
          </View>
        </View>

        {diagnosis.severity === 'high' ? <Notice message={t.urgent} /> : null}

        {event.photoPath ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={t.photo}
            contentFit="cover"
            source={{ uri: photoUri(event.photoPath) }}
            style={[styles.photo, { backgroundColor: colors.block }]}
          />
        ) : null}

        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionTitle}>
            {t.findings}
          </AppText>
          <Card style={styles.rows}>
            {diagnosis.findings.length === 0 ? (
              <AppText style={styles.row}>{t.none}</AppText>
            ) : (
              diagnosis.findings.map((finding, index) => (
                <View key={finding.name}>
                  {index > 0 ? (
                    <View style={[styles.divider, { backgroundColor: colors.hair }]} />
                  ) : null}
                  <View style={styles.row}>
                    <AppText variant="titleSm" style={styles.fill}>
                      {finding.name}
                    </AppText>
                    <Tag
                      label={t.likely[likelihoodOf(finding.confidence)]}
                      tone={likelihoodOf(finding.confidence) === 'high' ? 'berry' : 'soft'}
                    />
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionTitle}>
            {t.cause}
          </AppText>
          <Card>
            <AppText>{diagnosis.cause}</AppText>
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionTitle}>
            {t.actions}
          </AppText>
          <Card style={styles.rows}>
            {diagnosis.actions.map((action, index) => (
              <View key={action}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.hair }]} /> : null}
                <View style={styles.row}>
                  <AppText variant="numeralSm" color={colors.accent} style={styles.number}>
                    {index + 1}
                  </AppText>
                  <AppText style={styles.fill}>{action}</AppText>
                </View>
              </View>
            ))}
          </Card>
          <AppText variant="caption" style={styles.sectionTitle}>
            {t.recheck(diagnosis.recheckDays)}
          </AppText>
        </View>

        {left !== null && Number.isFinite(left) ? (
          <AppText variant="caption">{t.remaining(left)}</AppText>
        ) : null}
        <AppText variant="caption">{t.disclaimer}</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingVertical: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingBottom: spacing.xl * 2,
  },
  names: {
    gap: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    marginHorizontal: spacing.xs,
  },
  rows: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  number: {
    width: 20,
  },
  fill: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
