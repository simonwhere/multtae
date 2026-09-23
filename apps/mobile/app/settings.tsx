import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { eraseAll, exportBackup, importBackup } from '@/data/archive';
import { db } from '@/db/client';
import { getSetting } from '@/db/settings';
import { toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications/reschedule';
import { formatTimeOfDay, parseNotificationSettings } from '@/notifications/settings';
import type { NotificationSettings } from '@/notifications/settings';
import { usePlantUi } from '@/plants/ui-store';
import { nowContext } from '@/plants/use-now';
import { isWeatherUsable, temperatureSummary } from '@/weather/forecast';
import { findRegion } from '@/weather/regions';
import { useWeatherState } from '@/weather/store';
import { showCachedWeather, syncWeather } from '@/weather/sync';
import { AppText, BackButton, Card, Chevron, spacing, useColors } from '@/ui';

type TimeKey = 'notify_time' | 'bonsai_evening_time' | 'bonsai_winter_time' | 'dnd';
/** 내보내기·가져오기·전체 삭제는 오래 걸릴 수 있어 한 번에 하나만 (SPEC 3.6) */
type DataJob = 'export' | 'import' | 'erase';

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label} ${value}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppText style={styles.fill}>{label}</AppText>
      {value ? <AppText variant="caption">{value}</AppText> : null}
      {onPress ? <Chevron /> : null}
    </Pressable>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.hair }]} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </AppText>
      <Card style={styles.rows}>{children}</Card>
    </View>
  );
}

// 설정 (SPEC 3.6): 알림 시각·방해금지, 분재 확인 시각, 날씨 지역, 데이터, 버전.
// 난방 시즌 직접 정하기는 이후 태스크에서 더한다.
export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [notify, setNotify] = useState<NotificationSettings | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [job, setJob] = useState<DataJob | null>(null);
  const [dataNote, setDataNote] = useState<string | null>(null);
  const weather = useWeatherState((state) => state.weather);

  const load = useCallback(async () => {
    setNotify(
      parseNotificationSettings({
        notifyTime: await getSetting(db, 'notify_time'),
        dndStart: await getSetting(db, 'dnd_start'),
        dndEnd: await getSetting(db, 'dnd_end'),
        bonsaiEveningTime: await getSetting(db, 'bonsai_evening_time'),
        bonsaiWinterTime: await getSetting(db, 'bonsai_winter_time'),
      }),
    );
    setRegionId(await getSetting(db, 'region_code'));
  }, []);

  // 시트에서 돌아올 때마다 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const t = ko.settings;
  const openTime = (key: TimeKey) => router.push({ pathname: '/sheet/time', params: { key } });
  const region = findRegion(regionId);

  const context = nowContext();
  const usable = isWeatherUsable(weather, context.now, context.utcOffsetMinutes) && weather.region === region?.id;
  const summary = usable
    ? temperatureSummary(weather, toCalendarDate(context.now, context.utcOffsetMinutes))
    : null;
  const weatherLine =
    region === null
      ? t.regionHint
      : summary
        ? t[summary.when](summary.low, summary.high, summary.pop)
        : t.weatherOff;

  /** 기기 안의 것이 통째로 바뀌었다. 화면과 알림을 다시 맞춘다 */
  async function afterDataChange() {
    await load();
    usePlantUi.getState().bumpGarden();
    useWeatherState.getState().setWeather(null);
    void showCachedWeather().then(() => syncWeather());
    rescheduleSoon();
  }

  async function runExport() {
    setJob('export');
    setDataNote(null);
    const result = await exportBackup(context.now, context.utcOffsetMinutes);
    setJob(null);
    if (result === 'empty') setDataNote(t.exportEmpty);
    else if (result === 'unavailable') setDataNote(t.exportUnavailable);
    else if (result === 'failed') setDataNote(t.exportFailed);
  }

  async function runImport() {
    setJob('import');
    setDataNote(null);
    const result = await importBackup();
    if (result.status === 'imported') await afterDataChange();
    setJob(null);
    if (result.status === 'imported') {
      setDataNote(t.importDone(result.summary.spaces, result.summary.plants));
    } else if (result.status === 'invalid') setDataNote(t.importInvalid);
    else if (result.status === 'failed') setDataNote(t.importFailed);
  }

  async function runErase() {
    setJob('erase');
    setDataNote(null);
    const done = await eraseAll();
    if (done) await afterDataChange();
    setJob(null);
    setDataNote(done ? t.eraseDone : t.eraseFailed);
  }

  function confirm(title: string, body: string, confirmText: string, run: () => Promise<void>) {
    Alert.alert(title, body, [
      { text: ko.common.cancel, style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: () => void run() },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="titleLg" accessibilityRole="header">
          {t.title}
        </AppText>

        {notify ? (
          <>
            <Section title={t.notifications}>
              <Row
                label={t.notifyTime}
                value={formatTimeOfDay(notify.notifyMinute)}
                onPress={() => openTime('notify_time')}
              />
              <Divider />
              <Row
                label={t.dnd}
                value={
                  notify.quietHours
                    ? t.range(
                        formatTimeOfDay(notify.quietHours.start),
                        formatTimeOfDay(notify.quietHours.end),
                      )
                    : t.dndOff
                }
                onPress={() => openTime('dnd')}
              />
            </Section>

            <Section title={t.bonsai}>
              <Row
                label={t.bonsaiEvening}
                value={formatTimeOfDay(notify.bonsaiEveningMinute)}
                onPress={() => openTime('bonsai_evening_time')}
              />
              <Divider />
              <Row
                label={t.bonsaiWinter}
                value={formatTimeOfDay(notify.bonsaiWinterMinute)}
                onPress={() => openTime('bonsai_winter_time')}
              />
            </Section>
          </>
        ) : null}

        <Section title={t.weather}>
          <Row
            label={t.region}
            value={region ? region.id : t.regionNone}
            onPress={() => router.push('/sheet/region')}
          />
        </Section>
        <AppText variant="caption" style={styles.note}>
          {weatherLine}
        </AppText>

        <Section title={t.data}>
          <Row
            label={t.exportRow}
            value={job === 'export' ? t.exporting : ''}
            onPress={job ? undefined : () => void runExport()}
          />
          <Divider />
          <Row
            label={t.importRow}
            value={job === 'import' ? t.importing : ''}
            onPress={
              job ? undefined : () => confirm(t.importTitle, t.importBody, t.importConfirm, runImport)
            }
          />
          <Divider />
          <Row
            label={t.eraseRow}
            value=""
            onPress={
              job ? undefined : () => confirm(t.eraseTitle, t.eraseBody, t.eraseConfirm, runErase)
            }
          />
        </Section>
        <AppText variant="caption" style={styles.note}>
          {dataNote ?? t.exportHint}
        </AppText>

        <Section title={t.info}>
          <Row label={t.version} value={Constants.expoConfig?.version ?? ''} />
        </Section>
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
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingBottom: spacing.xl * 2,
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
  fill: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  note: {
    marginTop: -spacing.sm,
    marginHorizontal: spacing.xs,
  },
});
