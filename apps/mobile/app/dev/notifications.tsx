import * as Notifications from 'expo-notifications';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { useNotificationState } from '@/notifications';
import { expoNotifier } from '@/notifications/expo-notifier';
import { rescheduleAll } from '@/notifications/scheduler';
import { nowContext } from '@/plants/use-now';
import { AppText, Button, Card, spacing, useColors } from '@/ui';

// 개발용 알림 점검 화면 (/dev/notifications). 배포 빌드에서는 홈으로 돌려보낸다.
// 개발자만 보므로 글자는 영어로 두고, 알림 문구는 실제로 예약된 것을 그대로 보여 준다.

const TEST_DELAY_SECONDS = 5;

export default function NotificationsDevScreen() {
  const colors = useColors();
  const permission = useNotificationState((state) => state.permission);
  const [scheduled, setScheduled] = useState<Notifications.NotificationRequest[]>([]);
  const [summary, setSummary] = useState('');

  const load = useCallback(async () => {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    setScheduled(requests.sort((a, b) => a.identifier.slice(-10).localeCompare(b.identifier.slice(-10))));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function reschedule() {
    const { now, utcOffsetMinutes, coefficients } = nowContext();
    const result = await rescheduleAll(db, expoNotifier, { now, utcOffsetMinutes, coefficients });
    setSummary(`updated ${result.updatedPlants}, planned ${result.scheduled.length}`);
    await load();
  }

  // 예약된 첫 알림과 같은 내용을 몇 초 뒤에 띄워 모양을 본다
  async function fireFirst() {
    const first = scheduled[0]?.content;
    if (!first) return;
    await Notifications.scheduleNotificationAsync({
      identifier: 'dev-test',
      content: { title: first.title, body: first.body, sound: 'default', data: first.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: TEST_DELAY_SECONDS,
      },
    });
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="caption">{`PERMISSION ${permission ?? 'unknown'} · SCHEDULED ${scheduled.length}`}</AppText>
        {summary === '' ? null : <AppText variant="caption">{summary}</AppText>}
        <View style={styles.actions}>
          <Button label="rescheduleAll" onPress={() => void reschedule()} style={styles.fill} />
          <Button
            label={`fire first in ${TEST_DELAY_SECONDS}s`}
            variant="secondary"
            disabled={scheduled.length === 0}
            onPress={() => void fireFirst()}
            style={styles.fill}
          />
        </View>

        {scheduled.map((request) => (
          <Card key={request.identifier}>
            <AppText variant="caption">{request.identifier}</AppText>
            <AppText variant="titleSm">{request.content.title}</AppText>
            <AppText>{request.content.body}</AppText>
            <AppText variant="caption">{JSON.stringify(request.trigger)}</AppText>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fill: {
    flex: 1,
  },
});
