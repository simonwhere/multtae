import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { getEvent, updateEventPayload } from '@/db/events';
import type { EventWithPlant } from '@/db/events';
import { getPlantWithSpace, updatePlant } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import { likelihoodOf, parseDiagnosis } from '@/diagnose/diagnosis';
import type { Diagnosis } from '@/diagnose/diagnosis';
import { addDays, diffDays, toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { photoUri } from '@/photos/photo-store';
import { canApplyWateringHint, planWateringHint } from '@/plants/care';
import { formatMonthDay } from '@/plants/format';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { dateKey } from '@/weather/forecast';
import {
  AppText,
  BackButton,
  Button,
  Card,
  Notice,
  radius,
  spacing,
  Tag,
  TextButton,
  useColors,
} from '@/ui';

// 진단 결과 (SPEC 8.1, 9.3): 의심되는 것(가능성), 까닭, 지금 할 일 3개, 다시 볼 날, 면책 문구.
// 심각하면 위에 "빨리 손써 주세요"를 둔다. 기록 탭에서 다시 열 수 있다.
export default function DiagnosisScreen() {
  const colors = useColors();
  const router = useRouter();
  const { eventId, remaining } = useLocalSearchParams<{ eventId: string; remaining?: string }>();
  const [record, setRecord] = useState<EventWithPlant | 'missing' | null>(null);
  const [target, setTarget] = useState<PlantWithSpace | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void getEvent(db, eventId).then(async (found) => {
      setRecord(found ?? 'missing');
      if (found) setTarget(await getPlantWithSpace(db, found.event.plantId));
    });
  }, [eventId]);

  useEffect(load, [load]);

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
  const context = nowContext();
  const { utcOffsetMinutes } = context;
  const left = remaining === undefined ? null : Number(remaining);
  const diagnosedOn = toCalendarDate(event.occurredAt, utcOffsetMinutes);
  const today = toCalendarDate(context.now, utcOffsetMinutes);
  const recheckOn = addDays(diagnosedOn, diagnosis.recheckDays);
  const stored = diagnosis.recheckDate;
  const storedDate = stored
    ? (() => {
        const [year, month, day] = stored.split('-').map(Number) as [number, number, number];
        return { year, month, day };
      })()
    : null;

  /** 결과에 남긴 답을 고쳐 쓰고 알림을 다시 짠다 */
  async function save(next: Diagnosis) {
    setBusy(true);
    try {
      await updateEventPayload(db, event.id, next);
      rescheduleSoon();
      load();
    } finally {
      setBusy(false);
    }
  }

  async function answerHint(apply: boolean) {
    if (!target || !diagnosis) return;
    setBusy(true);
    try {
      if (apply) {
        const patch = planWateringHint(target.plant, target.space, diagnosis.wateringHint, context);
        if (patch) await updatePlant(db, target.plant.id, patch);
        usePlantUi.getState().bumpGarden();
      }
      await save({ ...diagnosis, hintAnswer: apply ? 'applied' : 'declined' });
    } finally {
      setBusy(false);
    }
  }

  const askHint = target !== null && canApplyWateringHint(target.plant, diagnosis.wateringHint);

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

        {/* 다시 볼 날 알림 (8.1, 12.1 재확인) */}
        {storedDate === null ? (
          diffDays(today, recheckOn) >= 0 ? (
            <Button
              label={t.recheckOn(diagnosis.recheckDays)}
              variant="secondary"
              disabled={busy}
              onPress={() => void save({ ...diagnosis, recheckDate: dateKey(recheckOn) })}
            />
          ) : null
        ) : diffDays(today, storedDate) >= 0 ? (
          <View style={styles.recheck}>
            <AppText style={styles.fill}>{t.recheckSet(formatMonthDay(storedDate))}</AppText>
            <TextButton
              label={t.recheckOff}
              disabled={busy}
              onPress={() => void save({ ...diagnosis, recheckDate: null })}
            />
          </View>
        ) : (
          <AppText variant="caption">{t.recheckPast(formatMonthDay(storedDate))}</AppText>
        )}

        {/* 물주기 판단 반영 (8.1 엔진 연동). 한 번 답하면 다시 묻지 않는다 */}
        {askHint && diagnosis.hintAnswer === null ? (
          <Card tone="highlight" style={styles.stack}>
            <AppText>{diagnosis.wateringHint === 'over' ? t.hintOver : t.hintUnder}</AppText>
            <View style={styles.actions}>
              <Button
                label={diagnosis.wateringHint === 'over' ? t.hintApplyOver : t.hintApplyUnder}
                disabled={busy}
                onPress={() => void answerHint(true)}
                style={styles.fill}
              />
              <Button
                label={t.hintKeep}
                variant="surface"
                disabled={busy}
                onPress={() => void answerHint(false)}
                style={styles.fill}
              />
            </View>
          </Card>
        ) : null}
        {diagnosis.hintAnswer ? (
          <AppText variant="caption">
            {diagnosis.hintAnswer === 'declined'
              ? t.hintDeclined
              : diagnosis.wateringHint === 'over'
                ? t.hintAppliedOver
                : t.hintAppliedUnder}
          </AppText>
        ) : null}

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
  recheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fill: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
