import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { getSetting } from '@/db/settings';
import { toCalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { formatTimeOfDay, parseNotificationSettings } from '@/notifications/settings';
import type { NotificationSettings } from '@/notifications/settings';
import { nowContext } from '@/plants/use-now';
import { dayOf, isWeatherUsable } from '@/weather/forecast';
import { findRegion } from '@/weather/regions';
import { useWeatherState } from '@/weather/store';
import { AppText, BackButton, Card, Chevron, spacing, useColors } from '@/ui';

type TimeKey = 'notify_time' | 'bonsai_evening_time' | 'bonsai_winter_time' | 'dnd';

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${value}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppText style={styles.fill}>{label}</AppText>
      <AppText variant="caption">{value}</AppText>
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

// 설정 (SPEC 3.6): 알림 시각·방해금지, 분재 확인 시각, 날씨 지역, 버전.
// 난방 시즌 직접 정하기와 데이터 내보내기는 이후 태스크에서 더한다.
export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [notify, setNotify] = useState<NotificationSettings | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const weather = useWeatherState((state) => state.weather);

  // 시트에서 돌아올 때마다 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      void (async () => {
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
      })();
    }, []),
  );

  const t = ko.settings;
  const openTime = (key: TimeKey) => router.push({ pathname: '/sheet/time', params: { key } });
  const region = findRegion(regionId);

  const context = nowContext();
  const usable = isWeatherUsable(weather, context.now, context.utcOffsetMinutes) && weather.region === region?.id;
  const today = usable ? dayOf(weather, toCalendarDate(context.now, context.utcOffsetMinutes)) : null;
  const weatherLine =
    region === null
      ? t.regionHint
      : today && today.tmin !== null && today.tmax !== null
        ? t.today(Math.round(today.tmin), Math.round(today.tmax), today.pop)
        : t.weatherOff;

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
