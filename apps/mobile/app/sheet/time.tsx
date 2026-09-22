import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { db } from '@/db/client';
import { deleteSetting, getSetting, setSetting } from '@/db/settings';
import { ko } from '@/i18n/ko';
import { rescheduleSoon } from '@/notifications';
import { formatTimeOfDay, parseNotificationSettings } from '@/notifications/settings';
import { AppText, Button, spacing, TextButton, useColors } from '@/ui';

type Key = 'notify_time' | 'bonsai_evening_time' | 'bonsai_winter_time' | 'dnd';

const toDate = (minuteOfDay: number) =>
  new Date(2000, 0, 1, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
const toMinute = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** iOS 는 시트 안에 돌림판을 두고, 안드로이드는 줄을 누르면 시계 창을 띄운다 */
function TimeField({
  label,
  minute,
  onChange,
}: {
  label?: string;
  minute: number;
  onChange: (minute: number) => void;
}) {
  const colors = useColors();

  if (Platform.OS === 'android') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? ''} ${formatTimeOfDay(minute)}`}
        onPress={() =>
          DateTimePickerAndroid.open({
            value: toDate(minute),
            mode: 'time',
            is24Hour: true,
            onChange: (event, date) => {
              if (event.type === 'set' && date) onChange(toMinute(date));
            },
          })
        }
        style={styles.androidRow}>
        {label ? <AppText style={styles.fill}>{label}</AppText> : null}
        <AppText variant="numeralMd">{formatTimeOfDay(minute)}</AppText>
      </Pressable>
    );
  }

  return (
    <View>
      {label ? <AppText variant="caption">{label}</AppText> : null}
      <DateTimePicker
        mode="time"
        display="spinner"
        locale="ko-KR"
        minuteInterval={5}
        textColor={colors.ink}
        value={toDate(minute)}
        onChange={(_, date) => {
          if (date) onChange(toMinute(date));
        }}
      />
    </View>
  );
}

// 알림 시각 고르기 (SPEC 3.6). 저장하면 알림을 바로 다시 짠다.
export default function TimeSheet() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: Key }>();
  const [minute, setMinute] = useState<number | null>(null);
  const [end, setEnd] = useState(7 * 60);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const settings = parseNotificationSettings({
        notifyTime: await getSetting(db, 'notify_time'),
        dndStart: await getSetting(db, 'dnd_start'),
        dndEnd: await getSetting(db, 'dnd_end'),
        bonsaiEveningTime: await getSetting(db, 'bonsai_evening_time'),
        bonsaiWinterTime: await getSetting(db, 'bonsai_winter_time'),
      });
      if (key === 'dnd') {
        // 처음 켜는 방해금지는 밤 10시부터 아침 7시까지로 시작한다
        setMinute(settings.quietHours?.start ?? 22 * 60);
        setEnd(settings.quietHours?.end ?? 7 * 60);
      } else if (key === 'notify_time') {
        setMinute(settings.notifyMinute);
      } else if (key === 'bonsai_evening_time') {
        setMinute(settings.bonsaiEveningMinute);
      } else {
        setMinute(settings.bonsaiWinterMinute);
      }
    })();
  }, [key]);

  if (minute === null) return <View style={styles.sheet} />;

  const t = ko.timeSheet;

  async function save(next: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await next();
      rescheduleSoon();
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const saveTime = () =>
    save(async () => {
      if (key === 'dnd') {
        await setSetting(db, 'dnd_start', formatTimeOfDay(minute));
        await setSetting(db, 'dnd_end', formatTimeOfDay(end));
      } else {
        await setSetting(db, key, formatTimeOfDay(minute));
      }
    });

  const turnOffDnd = () =>
    save(async () => {
      await deleteSetting(db, 'dnd_start');
      await deleteSetting(db, 'dnd_end');
    });

  return (
    <View style={styles.sheet}>
      <AppText variant="titleSm" accessibilityRole="header">
        {key === 'dnd' ? t.dndTitle : t[key]}
      </AppText>
      {key === 'dnd' ? <AppText variant="caption">{t.dndHint}</AppText> : null}
      {key === 'bonsai_winter_time' ? <AppText variant="caption">{t.bonsaiWinterHint}</AppText> : null}

      {key === 'dnd' ? (
        <>
          <TimeField label={t.start} minute={minute} onChange={setMinute} />
          <TimeField label={t.end} minute={end} onChange={setEnd} />
        </>
      ) : (
        <TimeField minute={minute} onChange={setMinute} />
      )}

      {failed ? <AppText>{ko.settings.saveFailed}</AppText> : null}
      <Button
        label={ko.common.save}
        disabled={busy || (key === 'dnd' && minute === end)}
        onPress={() => void saveTime()}
      />
      {key === 'dnd' ? (
        <View style={styles.center}>
          <TextButton label={t.dndOff} onPress={() => void turnOffDnd()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  androidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
  },
});
