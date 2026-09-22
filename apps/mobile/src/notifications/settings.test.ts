import { describe, expect, it } from 'vitest';

import type { CalendarDate } from '../engine';
import {
  DEFAULT_NOTIFY_MINUTE,
  formatTimeOfDay,
  parseNotificationSettings,
  parseTimeOfDay,
  shiftOutOfQuietHours,
} from './settings';

const date = (month: number, day: number): CalendarDate => ({ year: 2026, month, day });
const hm = (hour: number, minute = 0) => hour * 60 + minute;

describe('parseTimeOfDay: settings 의 "HH:MM"', () => {
  it('하루 중 몇 분째인지로 읽는다', () => {
    expect(parseTimeOfDay('08:00')).toBe(480);
    expect(parseTimeOfDay('7:30')).toBe(450);
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('23:59')).toBe(1439);
  });

  it('시각이 아니면 null', () => {
    for (const bad of [null, '', '8', '24:00', '08:60', '-1:00', '08:0', 'ab:cd', '08:00:00']) {
      expect(parseTimeOfDay(bad)).toBeNull();
    }
  });
});

describe('formatTimeOfDay: 설정 화면에서 고른 시각을 "HH:MM" 으로', () => {
  it('두 자리로 채우고 parseTimeOfDay 와 왕복한다', () => {
    expect(formatTimeOfDay(hm(8))).toBe('08:00');
    expect(formatTimeOfDay(hm(7, 5))).toBe('07:05');
    expect(formatTimeOfDay(hm(23, 59))).toBe('23:59');
    for (const minute of [0, 1, 450, 1439]) {
      expect(parseTimeOfDay(formatTimeOfDay(minute))).toBe(minute);
    }
  });

  it('하루를 넘거나 음수면 하루 안으로 돌린다', () => {
    expect(formatTimeOfDay(hm(24, 30))).toBe('00:30');
    expect(formatTimeOfDay(-30)).toBe('23:30');
  });
});

describe('parseNotificationSettings (SPEC.md 3.6)', () => {
  it('저장된 값이 없으면 오전 8시, 방해금지 없음', () => {
    const settings = parseNotificationSettings({ notifyTime: null, dndStart: null, dndEnd: null });

    expect(DEFAULT_NOTIFY_MINUTE).toBe(hm(8));
    expect(settings).toMatchObject({
      notifyMinute: hm(8),
      bonsaiEveningMinute: hm(19),
      bonsaiWinterMinute: hm(11),
      quietHours: null,
    });
  });

  it('알림 시각과 방해금지 구간을 읽는다', () => {
    const settings = parseNotificationSettings({
      notifyTime: '07:30',
      dndStart: '22:00',
      dndEnd: '07:00',
    });

    expect(settings).toMatchObject({
      notifyMinute: hm(7, 30),
      quietHours: { start: hm(22), end: hm(7) },
    });
  });

  it('깨진 알림 시각은 기본값으로, 한쪽만 있거나 시작과 끝이 같은 방해금지는 없는 것으로 본다', () => {
    expect(
      parseNotificationSettings({ notifyTime: '25:00', dndStart: '22:00', dndEnd: null }),
    ).toMatchObject({ notifyMinute: hm(8), quietHours: null });
    expect(
      parseNotificationSettings({ notifyTime: null, dndStart: '09:00', dndEnd: '09:00' }).quietHours,
    ).toBeNull();
  });
});

describe('shiftOutOfQuietHours: 방해금지 구간에 걸리면 종료 시각으로 옮긴다 (SPEC.md 12.2)', () => {
  const night = { start: hm(22), end: hm(7) };
  const morning = { start: hm(7), end: hm(9) };

  it('방해금지가 없거나 구간 밖이면 그대로', () => {
    expect(shiftOutOfQuietHours(date(9, 27), hm(8), null)).toEqual({
      date: date(9, 27),
      minuteOfDay: hm(8),
    });
    expect(shiftOutOfQuietHours(date(9, 27), hm(8), night)).toEqual({
      date: date(9, 27),
      minuteOfDay: hm(8),
    });
  });

  it('구간 안이면 같은 날 종료 시각으로', () => {
    expect(shiftOutOfQuietHours(date(9, 27), hm(8), morning)).toEqual({
      date: date(9, 27),
      minuteOfDay: hm(9),
    });
  });

  it('자정을 넘는 구간: 새벽이면 같은 날 종료 시각, 밤이면 다음 날 종료 시각', () => {
    expect(shiftOutOfQuietHours(date(9, 27), hm(6, 30), night)).toEqual({
      date: date(9, 27),
      minuteOfDay: hm(7),
    });
    expect(shiftOutOfQuietHours(date(9, 30), hm(23), night)).toEqual({
      date: date(10, 1),
      minuteOfDay: hm(7),
    });
  });

  it('시작 시각은 구간 안, 종료 시각은 구간 밖이다', () => {
    expect(shiftOutOfQuietHours(date(9, 27), hm(7), morning).minuteOfDay).toBe(hm(9));
    expect(shiftOutOfQuietHours(date(9, 27), hm(9), morning).minuteOfDay).toBe(hm(9));
    expect(shiftOutOfQuietHours(date(9, 27), hm(22), night).date).toEqual(date(9, 28));
    expect(shiftOutOfQuietHours(date(9, 27), hm(7), night)).toEqual({
      date: date(9, 27),
      minuteOfDay: hm(7),
    });
  });
});

describe('분재 알림 시각 (SPEC.md 3.6, 6.1, 6.3)', () => {
  it('설정한 값을 읽는다', () => {
    const settings = parseNotificationSettings({
      notifyTime: null,
      dndStart: null,
      dndEnd: null,
      bonsaiEveningTime: '18:00',
      bonsaiWinterTime: '10:30',
    });

    expect(settings).toMatchObject({ bonsaiEveningMinute: hm(18), bonsaiWinterMinute: hm(10, 30) });
  });
});
