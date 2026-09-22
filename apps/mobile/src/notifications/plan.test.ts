import { describe, expect, it } from 'vitest';

import type { CalendarDate } from '../engine';
import { planNotifications, SCHEDULE_DAYS, weatherAlertTime } from './plan';
import type { PlanInput, PlanPlant } from './plan';
import {
  DEFAULT_BONSAI_EVENING_MINUTE,
  DEFAULT_BONSAI_WINTER_MINUTE,
  DEFAULT_NOTIFY_MINUTE,
} from './settings';

const KST = 540;
const date = (month: number, day: number): CalendarDate => ({ year: 2026, month, day });
/** 기기 시간대(KST)의 그 날짜 몇 시 몇 분 */
const at = (month: number, day: number, hour = 0, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 9, minute);

// 2026-09-27 07:00 KST. 시나리오 B 의 물 주는 날, 알림이 울리기 전
const NOW = at(9, 27, 7);

const soil = (nickname: string, waterDate: CalendarDate): PlanPlant => ({
  nickname,
  waterDate,
  hydro: false,
  bonsai: false,
});

/** 분재는 물을 주는 대신 흙을 확인한다 (SPEC 6.1) */
const bonsai = (nickname: string, waterDate: CalendarDate): PlanPlant => ({
  nickname,
  waterDate,
  hydro: false,
  bonsai: true,
});

function plan(patch: Partial<PlanInput>) {
  return planNotifications({
    plants: [],
    seasonChanges: [],
    season: 'autumn',
    now: NOW,
    utcOffsetMinutes: KST,
    settings: {
      notifyMinute: DEFAULT_NOTIFY_MINUTE,
      bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
      bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
      quietHours: null,
    },
    ...patch,
  });
}

describe('planNotifications: 물주기 알림 (SPEC.md 12.1)', () => {
  it('시나리오 B: 물 주는 날 오전 8시에 알린다. 누르면 오늘 탭으로 간다', () => {
    const planned = plan({ plants: [soil('몬스테라', date(9, 27))] });

    expect(planned[0]).toEqual({
      id: 'water-20260927-0',
      type: 'water',
      date: date(9, 27),
      minuteOfDay: 480,
      title: '물때예요',
      body: '몬스테라 물 줄 때',
      target: 'today',
    });
  });

  it('같은 날 식물은 알림 하나로 묶는다 (12.2 묶기)', () => {
    const two = plan({
      plants: [soil('몬스테라', date(9, 28)), soil('벤자민', date(9, 28))],
    });
    const three = plan({
      plants: ['몬스테라', '벤자민', '곰솔'].map((name) => soil(name, date(9, 28))),
    });

    expect(two[0]).toMatchObject({ id: 'water-20260928-0', body: '몬스테라, 벤자민 2개 물 줄 때' });
    expect(three[0].body).toBe('몬스테라, 벤자민, 곰솔 3개 물 줄 때');
  });

  it('식물 이름은 세 개까지, 나머지는 "외 N개"', () => {
    const planned = plan({
      plants: ['몬스테라', '벤자민', '곰솔', '바질', '알로에'].map((name) =>
        soil(name, date(9, 28)),
      ),
    });

    expect(planned[0].body).toBe('몬스테라, 벤자민, 곰솔 외 2개 물 줄 때');
  });

  it('수경은 물주기 대신 물 교체를 알린다 (4.2)', () => {
    const planned = plan({
      plants: [
        soil('몬스테라', date(9, 28)),
        { nickname: '스킨답서스', waterDate: date(9, 28), hydro: true, bonsai: false },
      ],
    });

    expect(planned[0]).toMatchObject({
      id: 'water-20260928-0',
      title: '물때예요',
      body: '몬스테라 물 줄 때\n스킨답서스 물 갈 때',
    });
  });

  it('날짜마다 하나씩, 이른 것부터', () => {
    const planned = plan({
      plants: [soil('벤자민', date(10, 1)), soil('몬스테라', date(9, 27)), soil('곰솔', date(9, 29))],
    });

    expect(planned.filter((n) => n.type === 'water').map((n) => n.id)).toEqual([
      'water-20260927-0',
      'water-20260929-0',
      'water-20261001-0',
    ]);
  });

  it(`${SCHEDULE_DAYS}일치만 예약한다 (12.3)`, () => {
    const planned = plan({
      plants: [soil('끝', date(10, 10)), soil('밖', date(10, 11))],
    });

    expect(planned.map((n) => n.id)).toEqual(['water-20261010-0']);
  });

  it('이미 지난 시각은 예약하지 않는다', () => {
    const afterEight = plan({ plants: [soil('몬스테라', date(9, 27))], now: at(9, 27, 8) });

    expect(afterEight.map((n) => n.id)).not.toContain('water-20260927-0');
  });

  it('식물이 없으면 알릴 것도 없다', () => {
    expect(
      plan({ seasonChanges: [{ season: 'winter', date: date(10, 1), trend: 'longer' }] }),
    ).toEqual([]);
  });
});

describe('planNotifications: 밀림 알림 (SPEC.md 12.1)', () => {
  it('예정일 다음 날 오전 8시, 그 뒤로 3일마다', () => {
    const planned = plan({ plants: [soil('스킨답서스', date(9, 28))] });

    expect(planned.map((n) => n.id)).toEqual([
      'water-20260928-0',
      'overdue-20260929-0',
      'overdue-20261002-0',
      'overdue-20261005-0',
      'overdue-20261008-0',
    ]);
    expect(planned[1]).toMatchObject({
      type: 'overdue',
      title: '물주기가 밀렸어요',
      body: '스킨답서스 1일 지났어요',
      minuteOfDay: 480,
      target: 'today',
    });
    expect(planned[2].body).toBe('스킨답서스 4일 지났어요');
  });

  it('이미 밀린 식물은 그 박자를 이어 간다: 예정일 +1, +4, +7 ...', () => {
    // 9월 24일 예정 → 9월 25일, 28일, 10월 1일 ...
    const planned = plan({ plants: [soil('스킨답서스', date(9, 24))] });

    expect(planned.map((n) => n.id)).toEqual([
      'overdue-20260928-0',
      'overdue-20261001-0',
      'overdue-20261004-0',
      'overdue-20261007-0',
      'overdue-20261010-0',
    ]);
    expect(planned[0].body).toBe('스킨답서스 4일 지났어요');
  });

  it('밀린 식물이 여럿이면 이름을 묶는다', () => {
    const planned = plan({
      plants: [soil('스킨답서스', date(9, 26)), soil('벤자민', date(9, 23))],
    });

    // 9월 27일: 스킨답서스 +1, 벤자민 +4
    expect(planned[0]).toMatchObject({
      id: 'overdue-20260927-0',
      body: '스킨답서스, 벤자민 2개 물 줄 날이 지났어요',
    });
  });
});

describe('planNotifications: 계절 전환 알림 (SPEC.md 12.1)', () => {
  const winter = { season: 'winter' as const, date: date(10, 5), trend: 'longer' as const };

  it('전환일 오전 8시에 새 계절 모드와 주기 변화를 알린다', () => {
    const planned = plan({ plants: [soil('몬스테라', date(10, 20))], seasonChanges: [winter] });

    expect(planned).toEqual([
      {
        id: 'season-20261005-0',
        type: 'season',
        date: date(10, 5),
        minuteOfDay: 480,
        title: '겨울·난방 모드',
        body: '물주기가 전체적으로 늘었어요',
        target: 'today',
      },
    ]);
  });

  it('주기가 줄거나 그대로인 전환', () => {
    const body = (season: 'heat' | 'spring', trend: 'shorter' | 'same') =>
      plan({
        plants: [soil('몬스테라', date(10, 20))],
        seasonChanges: [{ season, date: date(10, 5), trend }],
      })[0];

    expect(body('heat', 'shorter')).toMatchObject({
      title: '폭염 모드',
      body: '물주기가 전체적으로 줄었어요',
    });
    expect(body('spring', 'same').body).toBe('물주기는 그대로예요');
  });
});

describe('planNotifications: 하루 상한과 방해금지 (SPEC.md 12.2)', () => {
  it('같은 아침의 물주기·밀림·계절 전환은 알림 하나에 줄로 합친다', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(9, 27)), soil('스킨답서스', date(9, 20))],
      seasonChanges: [{ season: 'winter', date: date(9, 27), trend: 'longer' }],
    });
    const today = planned.filter((n) => n.date.day === 27);

    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({
      id: 'water-20260927-0',
      type: 'water',
      title: '물때예요',
      body: '몬스테라 물 줄 때\n스킨답서스 7일 지났어요\n오늘부터 겨울·난방 모드, 물주기가 전체적으로 늘었어요',
    });
  });

  it('물 줄 식물이 없는 날은 밀림이 앞선다', () => {
    const planned = plan({
      plants: [soil('스킨답서스', date(9, 26))],
      seasonChanges: [{ season: 'winter', date: date(9, 27), trend: 'longer' }],
    });

    expect(planned[0]).toMatchObject({
      id: 'overdue-20260927-0',
      title: '물주기가 밀렸어요',
      body: '스킨답서스 1일 지났어요\n오늘부터 겨울·난방 모드, 물주기가 전체적으로 늘었어요',
    });
  });

  it('하루에 하나를 넘지 않는다', () => {
    const planned = plan({
      plants: Array.from({ length: 30 }, (_, index) => soil(`식물 ${index}`, date(9, 20 + (index % 12)))),
    });
    const perDay = new Map<string, number>();
    for (const n of planned) perDay.set(n.id.slice(-10), (perDay.get(n.id.slice(-10)) ?? 0) + 1);

    expect(planned.length).toBeLessThanOrEqual(SCHEDULE_DAYS);
    expect([...perDay.values()].every((count) => count === 1)).toBe(true);
  });

  it('설정한 알림 시각을 쓴다', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(9, 28))],
      settings: {
        notifyMinute: 7 * 60 + 30,
        bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
        bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
        quietHours: null,
      },
    });

    expect(planned[0].minuteOfDay).toBe(450);
  });

  it('방해금지 구간에 걸리면 종료 시각으로 옮긴다', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(9, 27))],
      settings: {
        notifyMinute: 480,
        bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
        bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
        quietHours: { start: 22 * 60, end: 9 * 60 },
      },
      now: at(9, 27, 8, 30),
    });

    // 8시는 지났지만 옮긴 9시는 아직이다
    expect(planned[0]).toMatchObject({
      id: 'water-20260927-0',
      date: date(9, 27),
      minuteOfDay: 540,
    });
  });

  it('밤 알림이 방해금지로 다음 날 아침으로 넘어가도 예약한 날의 알림이다', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(9, 27))],
      settings: {
        notifyMinute: 23 * 60,
        bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
        bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
        quietHours: { start: 22 * 60, end: 7 * 60 },
      },
    });

    expect(planned[0]).toMatchObject({
      id: 'water-20260927-0',
      date: date(9, 28),
      minuteOfDay: 420,
    });
  });
});

describe('planNotifications: 시간대', () => {
  it('기기 시간대의 날짜와 시각으로 센다 (12.2)', () => {
    // 로스앤젤레스(UTC-7)의 9월 27일 07:00
    const planned = plan({
      plants: [soil('몬스테라', date(9, 27))],
      now: Date.UTC(2026, 8, 27, 14),
      utcOffsetMinutes: -420,
    });

    expect(planned[0]).toMatchObject({ id: 'water-20260927-0', date: date(9, 27), minuteOfDay: 480 });
  });
});

describe('분재 흙 확인 알림 (SPEC.md 6.1, 12.1)', () => {
  it('분재는 물 주기 대신 흙을 확인하라고 한다. 일반 식물과 다른 알림이다', () => {
    const planned = plan({ plants: [bonsai('곰솔', date(9, 27))] });

    expect(planned[0]).toMatchObject({
      id: 'bonsai-20260927-0',
      type: 'bonsai',
      minuteOfDay: 480,
      title: '흙 확인할 때',
      body: '곰솔 흙이 말랐는지 봐 주세요',
      target: 'today',
    });
  });

  it('같은 날 분재는 묶고, 일반 식물과는 따로 알린다 (하루 상한 12.2)', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(9, 27)), bonsai('곰솔', date(9, 27)), bonsai('단풍', date(9, 27))],
    });
    const today = planned.filter((n) => n.date.day === 27);

    expect(today).toHaveLength(2);
    expect(today.map((n) => n.type)).toEqual(['water', 'bonsai']);
    expect(today[1]?.body).toBe('곰솔, 단풍 2개 흙이 말랐는지 봐 주세요');
  });

  it('폭염에는 저녁 7시에 한 번 더 본다', () => {
    const planned = plan({
      plants: [bonsai('곰솔', date(8, 1))],
      season: 'heat',
      now: at(8, 1, 6),
    });
    const first = planned.filter((n) => n.date.day === 1);

    expect(first.map((n) => n.id)).toEqual(['bonsai-20260801-0', 'bonsai-20260801-1']);
    expect(first[0]?.minuteOfDay).toBe(480);
    expect(first[1]?.minuteOfDay).toBe(19 * 60);
  });

  it('겨울에는 화분 속 물이 얼지 않게 11시로 미룬다 (6.3)', () => {
    const planned = plan({
      plants: [bonsai('곰솔', date(12, 1))],
      season: 'winter',
      now: at(12, 1, 6),
    });

    expect(planned[0]).toMatchObject({ id: 'bonsai-20261201-0', minuteOfDay: 11 * 60 });
  });

  it('계절이 바뀌면 그 뒤 날짜는 새 계절 규칙으로 짠다', () => {
    const planned = plan({
      plants: [bonsai('곰솔', date(11, 20))],
      season: 'autumn',
      seasonChanges: [{ season: 'winter', date: date(11, 16), trend: 'longer' }],
      now: at(11, 14, 6),
    });
    const check = planned.find((n) => n.type === 'bonsai' && n.date.day === 20);

    expect(check?.minuteOfDay).toBe(11 * 60);
  });

  it('분재가 밀리면 일반 식물처럼 밀림으로 알린다', () => {
    const planned = plan({ plants: [bonsai('곰솔', date(9, 24))] });

    expect(planned[0]).toMatchObject({ type: 'overdue', body: '곰솔 4일 지났어요' });
  });
});

describe('분재 작업 알림 (SPEC.md 6.2, 12.1)', () => {
  it('시작 월 1일 아침에 한 번 알린다', () => {
    const planned = plan({
      plants: [bonsai('곰솔', date(10, 20))],
      tasks: [{ nickname: '곰솔', labelKo: '묵은 잎 뽑기', monthStart: 10 }],
      now: at(9, 30, 7),
    });
    const task = planned.find((n) => n.type === 'task');

    expect(task).toMatchObject({
      id: 'task-20261001-0',
      date: date(10, 1),
      minuteOfDay: 480,
      title: '이번 달 할 일',
      body: '곰솔 묵은 잎 뽑기 할 때예요',
    });
  });

  it('같은 날 작업이 여럿이면 묶는다', () => {
    const planned = plan({
      plants: [bonsai('곰솔', date(10, 20))],
      tasks: [
        { nickname: '곰솔', labelKo: '묵은 잎 뽑기', monthStart: 10 },
        { nickname: '단풍', labelKo: '가지치기', monthStart: 10 },
      ],
      now: at(9, 30, 7),
    });

    expect(planned.find((n) => n.type === 'task')?.body).toBe(
      '곰솔 묵은 잎 뽑기, 단풍 가지치기 할 때예요',
    );
  });

  it('14일 안에 1일이 없으면 알리지 않는다', () => {
    const planned = plan({
      plants: [bonsai('곰솔', date(10, 20))],
      tasks: [{ nickname: '곰솔', labelKo: '순따기', monthStart: 5 }],
      now: at(9, 30, 7),
    });

    expect(planned.some((n) => n.type === 'task')).toBe(false);
  });
});

describe('날씨 규칙과 알림 (SPEC.md 7.2, 12.1)', () => {
  const outdoor = (nickname: string, waterDate: CalendarDate, isBonsai = false): PlanPlant => ({
    nickname,
    waterDate,
    hydro: false,
    bonsai: isBonsai,
    openAir: true,
  });

  it('폭염인 날 바깥 자리 식물이 물 줄 때면 아침 알림을 07시로 당긴다', () => {
    const planned = plan({
      now: at(9, 27, 6),
      plants: [outdoor('로즈마리', date(9, 27)), soil('몬스테라', date(9, 29))],
      heatDays: ['2026-09-27', '2026-09-28', '2026-09-29'],
    });

    expect(planned.slice(0, 3).map((item) => [item.id, item.minuteOfDay])).toEqual([
      ['water-20260927-0', 420],
      // 다음 날 바깥 식물의 밀림 알림도 당긴다
      ['overdue-20260928-0', 420],
      // 9/29 는 실내 식물만 알리는 날이라 그대로 8시
      ['water-20260929-0', 480],
    ]);
  });

  it('폭염이 아닌 날이나 이미 07시보다 이른 설정은 그대로', () => {
    const plants = [outdoor('로즈마리', date(9, 28))];

    expect(plan({ plants, heatDays: [] })[0]?.minuteOfDay).toBe(480);
    expect(
      plan({
        plants,
        heatDays: ['2026-09-28'],
        settings: {
          notifyMinute: 6 * 60,
          bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
          bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
          quietHours: null,
        },
      })[0]?.minuteOfDay,
    ).toBe(360);
  });

  it('바깥 분재의 아침 확인도 07시로 당기고, 저녁 확인은 그대로', () => {
    const planned = plan({
      season: 'heat',
      plants: [outdoor('곰솔', date(9, 28), true)],
      heatDays: ['2026-09-28'],
    });

    expect(
      planned.filter((item) => item.type === 'bonsai').map((item) => [item.id, item.minuteOfDay]),
    ).toEqual([
      ['bonsai-20260928-0', 420],
      ['bonsai-20260928-1', DEFAULT_BONSAI_EVENING_MINUTE],
    ]);
  });

  it('한파 예보 알림을 정해 둔 시각에 울린다', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(10, 20))],
      weatherAlert: {
        targetDate: '2026-09-28',
        fireAt: at(9, 27, 18),
        title: '한파 예보',
        body: '내일 새벽 -7도, 바깥에 둔 식물 2개를 챙겨 주세요',
      },
    });

    expect(planned).toContainEqual({
      id: 'weather-20260928-0',
      type: 'weather',
      date: date(9, 27),
      minuteOfDay: 18 * 60,
      title: '한파 예보',
      body: '내일 새벽 -7도, 바깥에 둔 식물 2개를 챙겨 주세요',
      target: 'today',
    });
  });

  it('이미 지난 경고는 다시 울리지 않는다', () => {
    const planned = plan({
      plants: [soil('몬스테라', date(10, 20))],
      weatherAlert: { targetDate: '2026-09-27', fireAt: at(9, 26, 18), title: '한파 예보', body: '' },
    });

    expect(planned.some((item) => item.type === 'weather')).toBe(false);
  });
});

describe('weatherAlertTime: 예보를 받은 직후, 06시 이후 (SPEC.md 12.1)', () => {
  const settings = {
    notifyMinute: DEFAULT_NOTIFY_MINUTE,
    bonsaiEveningMinute: DEFAULT_BONSAI_EVENING_MINUTE,
    bonsaiWinterMinute: DEFAULT_BONSAI_WINTER_MINUTE,
    quietHours: null,
  };

  it('처음 보는 경고는 1분 뒤에 울린다', () => {
    expect(weatherAlertTime('2026-09-28', null, { now: at(9, 27, 18, 30), utcOffsetMinutes: KST, settings })).toBe(
      at(9, 27, 18, 31),
    );
  });

  it('새벽에 받았으면 06시까지 기다린다', () => {
    expect(weatherAlertTime('2026-09-28', null, { now: at(9, 27, 3), utcOffsetMinutes: KST, settings })).toBe(
      at(9, 27, 6),
    );
  });

  it('같은 새벽을 이미 알리기로 했으면 그 시각 그대로. 앱을 열 때마다 다시 울리지 않는다', () => {
    const stored = { targetDate: '2026-09-28', fireAt: at(9, 27, 18, 31) };

    expect(weatherAlertTime('2026-09-28', stored, { now: at(9, 27, 21), utcOffsetMinutes: KST, settings })).toBe(
      at(9, 27, 18, 31),
    );
    expect(weatherAlertTime('2026-09-29', stored, { now: at(9, 28, 9), utcOffsetMinutes: KST, settings })).toBe(
      at(9, 28, 9, 1),
    );
  });

  it('방해금지 구간이면 끝나는 시각으로', () => {
    const quiet = { ...settings, quietHours: { start: 22 * 60, end: 7 * 60 } };

    expect(weatherAlertTime('2026-09-28', null, { now: at(9, 27, 23), utcOffsetMinutes: KST, settings: quiet })).toBe(
      at(9, 28, 7),
    );
  });
});

describe('비료와 분갈이 (SPEC.md 8.2, 8.3, 12.1)', () => {
  const fed = (nickname: string, waterDate: CalendarDate): PlanPlant => ({
    ...soil(nickname, waterDate),
    fertilize: true,
  });

  it('물 줄 식물이 모두 비료 차례면 한 줄로 "비료도 함께"', () => {
    expect(plan({ plants: [fed('몬스테라', date(9, 28))] })[0]?.body).toBe(
      '몬스테라 물 줄 때, 비료도 함께',
    );
  });

  it('일부만 비료 차례면 따로 한 줄', () => {
    const planned = plan({ plants: [fed('몬스테라', date(9, 28)), soil('벤자민', date(9, 28))] });

    expect(planned[0]?.body).toBe('몬스테라, 벤자민 2개 물 줄 때\n몬스테라 비료도 함께');
  });

  it('분재 아침 확인에도 비료 줄을 덧붙인다', () => {
    const planned = plan({ plants: [{ ...bonsai('곰솔', date(9, 28)), fertilize: true }] });

    expect(planned.find((item) => item.type === 'bonsai')?.body).toBe(
      '곰솔 흙이 말랐는지 봐 주세요\n곰솔 비료도 함께',
    );
  });

  it('분갈이 검토는 그달 1일 아침에. 작업이 있으면 같은 알림에 한 줄로', () => {
    const repot = { nickname: '에케베리아', months: 24, known: true, date: date(10, 1) };

    expect(plan({ plants: [soil('몬스테라', date(10, 20))], repots: [repot] })).toContainEqual({
      id: 'task-20261001-0',
      type: 'task',
      date: date(10, 1),
      minuteOfDay: DEFAULT_NOTIFY_MINUTE,
      title: '분갈이 검토',
      body: '에케베리아 마지막 분갈이 2년 지났어요',
      target: 'today',
    });

    const merged = plan({
      plants: [soil('몬스테라', date(10, 20))],
      tasks: [{ nickname: '곰솔', labelKo: '철사걸이', monthStart: 10 }],
      repots: [{ ...repot, months: 19, known: true }, { nickname: '스킨답서스', months: 18, known: false, date: date(10, 1) }],
    }).find((item) => item.id === 'task-20261001-0');
    expect(merged).toMatchObject({
      title: '이번 달 할 일',
      body: '곰솔 철사걸이 할 때예요\n에케베리아 마지막 분갈이 19개월 지났어요\n스킨답서스 분갈이할 때가 됐어요',
    });
  });
});
