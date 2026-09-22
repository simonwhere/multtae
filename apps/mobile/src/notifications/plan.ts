/**
 * 앞으로 14일치 로컬 알림을 짠다 (SPEC.md 12). 무엇을 언제 띄울지만 정하는 순수 함수이고,
 * 예약은 scheduler 가 한다. 2-4 에서는 물주기·밀림·계절 전환만 다룬다.
 *
 * 하루 상한(12.2)은 물주기 1, 분재 2, 경고 1 이다. 밀림과 계절 전환도 같은 아침 시각에 울리므로
 * 작업·분갈이처럼 아침 알림 하나에 줄로 합친다. 그래서 여기서 나오는 알림은 하루에 하나다.
 */
import { addDays, diffDays, startOfDay, toCalendarDate } from '../engine';
import type { CalendarDate, Season } from '../engine';
import { ko } from '../i18n/ko';
import { dateKey } from '../weather/forecast';
import { HEAT_MORNING_MINUTE, shiftOutOfQuietHours } from './settings';
import type { NotificationSettings } from './settings';

/** 예약해 두는 기간. iOS 예약 상한 64개 안에 들도록 14일 × 하루 4개로 잡았다 (12.3) */
export const SCHEDULE_DAYS = 14;
/** 밀림 알림: 예정일 +1일, 이후 3일마다 (12.1) */
export const OVERDUE_FIRST_DAY = 1;
export const OVERDUE_REPEAT_DAYS = 3;
/** 알림 하나에 적는 식물명 수 (12.2 묶기) */
export const MAX_NAMES = 3;

const MS_PER_MINUTE = 60_000;
/** 하루 안에서 알림을 구분하는 자리. 분재는 폭염 때 저녁에 한 번 더 본다 (SPEC 6.1) */
const MORNING_SLOT = 0;
const EVENING_SLOT = 1;

export type NotificationType = 'water' | 'overdue' | 'season' | 'bonsai' | 'task' | 'weather';
/** 알림을 누르면 갈 곳 (12.1) */
export type NotificationTarget = 'today';

export interface PlannedNotification {
  /** `${type}-${yyyymmdd}-${slot}`. 같은 id 로 다시 예약하면 덮어써서 중복이 생기지 않는다 (12.3) */
  id: string;
  type: NotificationType;
  /** 울리는 날짜와 시각 (기기 로컬) */
  date: CalendarDate;
  minuteOfDay: number;
  title: string;
  body: string;
  target: NotificationTarget;
}

export interface PlanPlant {
  nickname: string;
  /** 다음 물주기 날짜 (기기 로컬) */
  waterDate: CalendarDate;
  /** 수경은 물주기 대신 물 교체를 알린다 (4.2) */
  hydro: boolean;
  /** 분재는 물 주기 대신 흙을 확인하라고 따로 알린다 (6.1) */
  bonsai: boolean;
  /** 테라스·옥외나 발코니 확장에 있다. 폭염인 날 아침 알림을 당긴다 (7.2) */
  openAir?: boolean;
  /** 물 줄 날에 비료도 함께 줄 때다 (8.2) */
  fertilize?: boolean;
}

/** 분갈이 검토 (8.3). 적기 월 1일 아침에 알린다 */
export interface PlanRepot {
  nickname: string;
  /** 마지막 분갈이(모르면 등록일)에서 지난 달 수 */
  months: number;
  /** 마지막 분갈이를 안다 */
  known: boolean;
  /** 알릴 날(그달 1일) */
  date: CalendarDate;
}

/** 한파·서리 예보 알림 (12.1). 울릴 시각은 부르는 쪽이 정해 둔다(weatherAlertTime) */
export interface PlanWeatherAlert {
  /** 경고하는 새벽의 날짜 YYYY-MM-DD. 알림 id 에 쓴다 */
  targetDate: string;
  fireAt: number;
  title: string;
  body: string;
}

export interface SeasonNotice {
  season: Season;
  /** 전환일. 이날 0시부터 새 계절이다 */
  date: CalendarDate;
  /** 새 계절에 내 식물들의 주기가 전체적으로 어떻게 바뀌나 */
  trend: 'longer' | 'shorter' | 'same';
}

/** 분재 작업 하나 (SPEC 6.2). 시작 월 1일 아침에 알린다 */
export interface PlanTask {
  nickname: string;
  labelKo: string;
  /** 1~12 */
  monthStart: number;
}

export interface PlanInput {
  plants: readonly PlanPlant[];
  /** 분재 작업. 없으면 빈 배열 */
  tasks?: readonly PlanTask[];
  /** 분갈이 검토. 없으면 빈 배열 */
  repots?: readonly PlanRepot[];
  seasonChanges: readonly SeasonNotice[];
  /** 오늘의 계절. 전환일 뒤의 날짜는 seasonChanges 로 본다 */
  season: Season;
  now: number;
  /** 기기 시간대의 UTC 오프셋(분). 알림은 기기 시간대로 센다 (12.2) */
  utcOffsetMinutes: number;
  settings: NotificationSettings;
  /** 최고 33도 이상인 날(YYYY-MM-DD). 바깥 자리 식물의 아침 알림을 07시로 당긴다 (7.2) */
  heatDays?: readonly string[];
  weatherAlert?: PlanWeatherAlert | null;
}

const pad = (value: number, length: number) => String(value).padStart(length, '0');

function notificationId(type: NotificationType, date: CalendarDate, slot: number): string {
  return `${type}-${pad(date.year, 4)}${pad(date.month, 2)}${pad(date.day, 2)}-${slot}`;
}

function names(plants: readonly PlanPlant[]): string {
  return ko.notifications.names(
    plants.slice(0, MAX_NAMES).map((plant) => plant.nickname),
    plants.length,
  );
}

/** 예정일에서 late 일 지난 날에 밀림 알림을 보내는가: +1일, 이후 3일마다 (12.1) */
function isOverdueReminder(late: number): boolean {
  return late >= OVERDUE_FIRST_DAY && (late - OVERDUE_FIRST_DAY) % OVERDUE_REPEAT_DAYS === 0;
}

/** 그날 아침 알림에 들어갈 줄들. 앞에 오는 줄의 종류가 알림의 종류가 된다 */
function morningLines(
  day: CalendarDate,
  input: PlanInput,
): { type: NotificationType; title: string; text: string }[] {
  const t = ko.notifications;
  const lines: { type: NotificationType; title: string; text: string }[] = [];

  // 분재는 따로 알린다 (6.1)
  const due = input.plants.filter(
    (plant) => !plant.bonsai && diffDays(plant.waterDate, day) === 0,
  );
  const soil = due.filter((plant) => !plant.hydro);
  const hydro = due.filter((plant) => plant.hydro);
  // 비료는 물 줄 때 함께 준다 (8.2). 물 줄 식물이 모두 비료 차례면 한 줄로, 아니면 따로 한 줄
  const fertilize = due.filter((plant) => plant.fertilize);
  const allFertilize = fertilize.length > 0 && fertilize.length === soil.length && hydro.length === 0;
  if (soil.length > 0) {
    lines.push({
      type: 'water',
      title: t.waterTitle,
      text: allFertilize ? t.waterFertBody(names(soil)) : t.waterBody(names(soil)),
    });
  }
  if (hydro.length > 0) lines.push({ type: 'water', title: t.waterTitle, text: t.hydroBody(names(hydro)) });
  if (fertilize.length > 0 && !allFertilize) {
    lines.push({ type: 'water', title: t.waterTitle, text: t.fertLine(names(fertilize)) });
  }

  const overdue = input.plants.filter((plant) => isOverdueReminder(diffDays(plant.waterDate, day)));
  if (overdue.length > 0) {
    lines.push({
      type: 'overdue',
      title: t.overdueTitle,
      text:
        overdue.length === 1
          ? t.overdueOne(overdue[0].nickname, diffDays(overdue[0].waterDate, day))
          : t.overdueMany(names(overdue)),
    });
  }

  const change = input.seasonChanges.find((notice) => diffDays(notice.date, day) === 0);
  if (change) {
    const mode = ko.seasonMode[change.season];
    const trend = t.seasonTrend[change.trend];
    lines.push({
      type: 'season',
      title: t.seasonTitle(mode),
      // 혼자 울릴 때는 제목이 계절 모드를 말한다. 다른 줄 뒤에 붙을 때는 줄 안에 적는다
      text: lines.length === 0 ? trend : t.seasonLine(mode, trend),
    });
  }

  return lines;
}

/** 그날의 계절. 전환일부터 새 계절이다 */
function seasonOn(day: CalendarDate, input: PlanInput): Season {
  let season = input.season;
  for (const change of input.seasonChanges) {
    if (diffDays(change.date, day) >= 0) season = change.season;
  }
  return season;
}

/**
 * 분재 흙 확인 알림의 시각 (SPEC 6.1, 6.3).
 * 폭염에는 아침과 저녁 두 번, 겨울에는 화분 속 물이 얼지 않게 늦은 오전 한 번이다.
 */
function bonsaiMinutes(season: Season, settings: NotificationSettings): [number, number][] {
  if (season === 'winter') return [[settings.bonsaiWinterMinute, MORNING_SLOT]];
  if (season === 'heat') {
    return [
      [settings.notifyMinute, MORNING_SLOT],
      [settings.bonsaiEveningMinute, EVENING_SLOT],
    ];
  }
  return [[settings.notifyMinute, MORNING_SLOT]];
}

/**
 * 아침 알림 시각. 폭염인 날 바깥 자리 식물이 물 줄 때(밀린 것 포함)면 07시로 당긴다 (7.2).
 * 설정 시각이 이미 그보다 이르면 그대로 둔다. 분재 알림과 물주기 알림을 따로 본다.
 */
function morningMinute(day: CalendarDate, input: PlanInput, bonsai: boolean, minute: number): number {
  if (!input.heatDays?.includes(dateKey(day))) return minute;

  const outdoorInMorning = input.plants.some((plant) => {
    if (!plant.openAir || plant.bonsai !== bonsai) return false;
    const late = diffDays(plant.waterDate, day);
    // 그날 알림에 들어가는 식물만 본다: 물 줄 날이거나, 분재가 아니면서 밀림 알림이 가는 날
    return late === 0 || (!bonsai && isOverdueReminder(late));
  });
  return outdoorInMorning ? Math.min(minute, HEAT_MORNING_MINUTE) : minute;
}

/** 날씨 경고는 06시 전에는 울리지 않는다 (12.1) */
const WEATHER_EARLIEST_MINUTE = 6 * 60;

/**
 * 한파·서리 예보 알림을 울릴 시각 (12.1 "예보 수신 직후, 06:00 이후").
 * 같은 새벽을 이미 알리기로 했으면 그 시각을 그대로 쓴다. 그래야 앱을 열 때마다 다시 울리지 않는다.
 */
export function weatherAlertTime(
  targetDate: string,
  stored: { targetDate: string; fireAt: number } | null,
  context: { now: number; utcOffsetMinutes: number; settings: NotificationSettings },
): number {
  if (stored && stored.targetDate === targetDate) return stored.fireAt;

  const { now, utcOffsetMinutes, settings } = context;
  const today = toCalendarDate(now, utcOffsetMinutes);
  const earliest = startOfDay(today, utcOffsetMinutes) + WEATHER_EARLIEST_MINUTE * MS_PER_MINUTE;
  const at = Math.max(now + MS_PER_MINUTE, earliest);

  const date = toCalendarDate(at, utcOffsetMinutes);
  const minuteOfDay = Math.floor((at - startOfDay(date, utcOffsetMinutes)) / MS_PER_MINUTE);
  const fire = shiftOutOfQuietHours(date, minuteOfDay, settings.quietHours);
  return startOfDay(fire.date, utcOffsetMinutes) + fire.minuteOfDay * MS_PER_MINUTE;
}

function planWeatherAlert(input: PlanInput): PlannedNotification[] {
  const alert = input.weatherAlert;
  if (!alert || alert.fireAt <= input.now) return [];

  const date = toCalendarDate(alert.fireAt, input.utcOffsetMinutes);
  const [year, month, day] = alert.targetDate.split('-').map(Number);
  return [
    {
      id: notificationId('weather', { year, month, day }, MORNING_SLOT),
      type: 'weather',
      date,
      minuteOfDay: Math.round((alert.fireAt - startOfDay(date, input.utcOffsetMinutes)) / MS_PER_MINUTE),
      title: alert.title,
      body: alert.body,
      target: 'today',
    },
  ];
}

export function planNotifications(input: PlanInput): PlannedNotification[] {
  // 식물이 없으면 계절이 바뀌어도 알릴 것이 없다
  if (input.plants.length === 0) return [];

  const today = toCalendarDate(input.now, input.utcOffsetMinutes);
  const planned: PlannedNotification[] = [];

  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const lines = morningLines(day, input);
    if (lines.length === 0) continue;

    const minute = morningMinute(day, input, false, input.settings.notifyMinute);
    const fire = shiftOutOfQuietHours(day, minute, input.settings.quietHours);
    const fireAt =
      startOfDay(fire.date, input.utcOffsetMinutes) + fire.minuteOfDay * MS_PER_MINUTE;
    if (fireAt <= input.now) continue;

    planned.push({
      // 방해금지로 다음 날로 넘어가도 예약한 날의 알림이다
      id: notificationId(lines[0].type, day, MORNING_SLOT),
      type: lines[0].type,
      date: fire.date,
      minuteOfDay: fire.minuteOfDay,
      title: lines[0].title,
      body: lines.map((line) => line.text).join('\n'),
      target: 'today',
    });
  }

  return [...planned, ...planBonsai(input), ...planTasks(input), ...planWeatherAlert(input)].sort(
    byWhen,
  );
}

/** 이른 것부터. diffDays(from, to) 는 to 가 나중이면 양수라 순서를 뒤집어 쓴다 */
function byWhen(a: PlannedNotification, b: PlannedNotification): number {
  return diffDays(b.date, a.date) || a.minuteOfDay - b.minuteOfDay;
}

/** 분재 흙 확인 알림 (SPEC 6.1). 물주기 알림과 별개라 같은 아침에 둘 다 올 수 있다 (12.2 하루 상한) */
function planBonsai(input: PlanInput): PlannedNotification[] {
  const bonsai = input.plants.filter((plant) => plant.bonsai);
  if (bonsai.length === 0) return [];

  const today = toCalendarDate(input.now, input.utcOffsetMinutes);
  const planned: PlannedNotification[] = [];

  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const due = bonsai.filter((plant) => diffDays(plant.waterDate, day) === 0);
    if (due.length === 0) continue;

    for (const [minute, slot] of bonsaiMinutes(seasonOn(day, input), input.settings)) {
      // 폭염인 날 바깥 분재는 아침 확인도 07시로 당긴다 (7.2)
      const pulled = slot === MORNING_SLOT ? morningMinute(day, input, true, minute) : minute;
      const fire = shiftOutOfQuietHours(day, pulled, input.settings.quietHours);
      const fireAt = startOfDay(fire.date, input.utcOffsetMinutes) + fire.minuteOfDay * MS_PER_MINUTE;
      if (fireAt <= input.now) continue;

      // 분재도 비료 차례면 아침 알림에 한 줄 덧붙인다 (8.2)
      const fertilize = slot === MORNING_SLOT ? due.filter((plant) => plant.fertilize) : [];
      planned.push({
        id: notificationId('bonsai', day, slot),
        type: 'bonsai',
        date: fire.date,
        minuteOfDay: fire.minuteOfDay,
        title: ko.notifications.bonsaiTitle,
        body: [
          ko.notifications.bonsaiBody(names(due)),
          ...(fertilize.length > 0 ? [ko.notifications.fertLine(names(fertilize))] : []),
        ].join('\n'),
        target: 'today',
      });
    }
  }

  return planned;
}

/**
 * 달마다 할 일 (SPEC 6.2 분재 작업, 8.3 분갈이). 그달 1일 아침에 한 번에 알린다 (12.2 작업·분갈이는 한 알림).
 * 작업이 있으면 제목은 "이번 달 할 일", 분갈이만 있으면 "분갈이 검토"다.
 */
function planTasks(input: PlanInput): PlannedNotification[] {
  const tasks = input.tasks ?? [];
  const repots = input.repots ?? [];
  if (tasks.length === 0 && repots.length === 0) return [];

  const today = toCalendarDate(input.now, input.utcOffsetMinutes);
  const planned: PlannedNotification[] = [];

  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    if (day.day !== 1) continue;

    const starting = tasks.filter((task) => task.monthStart === day.month);
    const repotting = repots.filter((repot) => diffDays(repot.date, day) === 0);
    if (starting.length === 0 && repotting.length === 0) continue;

    const fire = shiftOutOfQuietHours(day, input.settings.notifyMinute, input.settings.quietHours);
    const fireAt = startOfDay(fire.date, input.utcOffsetMinutes) + fire.minuteOfDay * MS_PER_MINUTE;
    if (fireAt <= input.now) continue;

    const lines = [
      ...(starting.length > 0
        ? [
            ko.notifications.taskBody(
              starting
                .slice(0, MAX_NAMES)
                .map((task) => `${task.nickname} ${task.labelKo}`)
                .join(', '),
            ),
          ]
        : []),
      ...repotting
        .slice(0, MAX_NAMES)
        .map((repot) => ko.notifications.repotBody(repot.nickname, repot.months, repot.known)),
    ];

    planned.push({
      id: notificationId('task', day, MORNING_SLOT),
      type: 'task',
      date: fire.date,
      minuteOfDay: fire.minuteOfDay,
      title: starting.length > 0 ? ko.notifications.taskTitle : ko.notifications.repotTitle,
      body: lines.join('\n'),
      target: 'today',
    });
  }

  return planned;
}
