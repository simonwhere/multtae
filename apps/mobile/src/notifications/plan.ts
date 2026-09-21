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
import { shiftOutOfQuietHours } from './settings';
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

export type NotificationType = 'water' | 'overdue' | 'season' | 'bonsai' | 'task';
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
  seasonChanges: readonly SeasonNotice[];
  /** 오늘의 계절. 전환일 뒤의 날짜는 seasonChanges 로 본다 */
  season: Season;
  now: number;
  /** 기기 시간대의 UTC 오프셋(분). 알림은 기기 시간대로 센다 (12.2) */
  utcOffsetMinutes: number;
  settings: NotificationSettings;
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
  if (soil.length > 0) lines.push({ type: 'water', title: t.waterTitle, text: t.waterBody(names(soil)) });
  if (hydro.length > 0) lines.push({ type: 'water', title: t.waterTitle, text: t.hydroBody(names(hydro)) });

  const overdue = input.plants.filter((plant) => {
    const late = diffDays(plant.waterDate, day);
    return late >= OVERDUE_FIRST_DAY && (late - OVERDUE_FIRST_DAY) % OVERDUE_REPEAT_DAYS === 0;
  });
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

export function planNotifications(input: PlanInput): PlannedNotification[] {
  // 식물이 없으면 계절이 바뀌어도 알릴 것이 없다
  if (input.plants.length === 0) return [];

  const today = toCalendarDate(input.now, input.utcOffsetMinutes);
  const planned: PlannedNotification[] = [];

  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const lines = morningLines(day, input);
    if (lines.length === 0) continue;

    const fire = shiftOutOfQuietHours(day, input.settings.notifyMinute, input.settings.quietHours);
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

  return [...planned, ...planBonsai(input), ...planTasks(input)].sort(byWhen);
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
      const fire = shiftOutOfQuietHours(day, minute, input.settings.quietHours);
      const fireAt = startOfDay(fire.date, input.utcOffsetMinutes) + fire.minuteOfDay * MS_PER_MINUTE;
      if (fireAt <= input.now) continue;

      planned.push({
        id: notificationId('bonsai', day, slot),
        type: 'bonsai',
        date: fire.date,
        minuteOfDay: fire.minuteOfDay,
        title: ko.notifications.bonsaiTitle,
        body: ko.notifications.bonsaiBody(names(due)),
        target: 'today',
      });
    }
  }

  return planned;
}

/** 분재 작업 알림 (SPEC 6.2). 시작 월 1일 아침에 그달 작업을 한 번에 알린다 */
function planTasks(input: PlanInput): PlannedNotification[] {
  const tasks = input.tasks ?? [];
  if (tasks.length === 0) return [];

  const today = toCalendarDate(input.now, input.utcOffsetMinutes);
  const planned: PlannedNotification[] = [];

  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    if (day.day !== 1) continue;

    const starting = tasks.filter((task) => task.monthStart === day.month);
    if (starting.length === 0) continue;

    const fire = shiftOutOfQuietHours(day, input.settings.notifyMinute, input.settings.quietHours);
    const fireAt = startOfDay(fire.date, input.utcOffsetMinutes) + fire.minuteOfDay * MS_PER_MINUTE;
    if (fireAt <= input.now) continue;

    planned.push({
      id: notificationId('task', day, MORNING_SLOT),
      type: 'task',
      date: fire.date,
      minuteOfDay: fire.minuteOfDay,
      title: ko.notifications.taskTitle,
      body: ko.notifications.taskBody(
        starting
          .slice(0, MAX_NAMES)
          .map((task) => `${task.nickname} ${task.labelKo}`)
          .join(', '),
      ),
      target: 'today',
    });
  }

  return planned;
}
