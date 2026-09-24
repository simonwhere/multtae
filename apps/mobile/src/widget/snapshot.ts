/**
 * 홈 화면 위젯에 넘길 내용 (9-3). 오늘부터 며칠치 문구를 앱이 미리 만들어 둔다.
 * 위젯은 오늘 날짜에 맞는 것을 골라 보여 주기만 해서, 자정이 지나 앱을 열지 않아도 넘어가고
 * 한국어 문구와 색은 ko.ts·tokens.ts 한 곳에 남는다 (CLAUDE.md 절대 규칙).
 */
import type { PlantWithSpace } from '../db/plants';
import { addDays, startOfDay, toCalendarDate } from '../engine';
import type { CalendarDate } from '../engine';
import { ko } from '../i18n/ko';
import { formatDaysLeft, formatDottedDate, formatMonthDay, formatWeekday } from '../plants/format';
import { classifyToday } from '../plants/today';
import { colors } from '../ui/tokens';
import type { ColorTokens } from '../ui/tokens';

/** app.json 의 App Group. 위젯(targets/widget)도 같은 이름으로 읽는다 */
export const WIDGET_APP_GROUP = 'group.kr.multtae.app';
/** 공유 저장소에 내용을 넣어 두는 키 */
export const WIDGET_KEY = 'snapshot';
/** app.json 의 안드로이드 위젯 이름 */
export const ANDROID_WIDGET_NAME = 'Today';
/** 며칠치를 만드는지. 일주일 안에 한 번은 앱을 연다고 본다 */
export const WIDGET_DAYS = 7;
/** 위젯에 이름을 몇 줄까지 쓰는지 */
export const WIDGET_LINES = 3;
/** 모양이 바뀌면 올린다. 위젯은 모르는 판이면 그리지 않는다 */
export const WIDGET_VERSION = 1;

export interface WidgetLine {
  name: string;
  /** "오늘", "2일 지남" */
  tag: string;
  overdue: boolean;
}

export interface WidgetDay {
  /** 기기 시간대의 날짜 YYYY-MM-DD. 위젯이 오늘 것을 고른다 */
  date: string;
  /** "9.24" */
  dateLabel: string;
  weekday: string;
  /** 물 줄 식물 수 (밀린 것 포함) */
  count: number;
  headline: string;
  lines: WidgetLine[];
  /** "외 2개" */
  more: string | null;
  /** 물 줄 식물이 없는 날의 다음 예정 */
  next: string | null;
}

/** 위젯이 쓰는 색만 */
export type WidgetColors = Pick<
  ColorTokens,
  'paper' | 'surface' | 'ink' | 'sub' | 'accent' | 'highlight' | 'berry' | 'berryTint'
>;

export interface WidgetSnapshot {
  version: number;
  /** 만들어 둔 날을 다 썼을 때 보여 줄 말 */
  stale: string;
  colors: { light: WidgetColors; dark: WidgetColors };
  days: WidgetDay[];
}

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (date: CalendarDate) => `${date.year}-${pad(date.month)}-${pad(date.day)}`;

export function widgetColors(tokens: ColorTokens): WidgetColors {
  const { paper, surface, ink, sub, accent, highlight, berry, berryTint } = tokens;
  return { paper, surface, ink, sub, accent, highlight, berry, berryTint };
}

function dayOf(
  items: readonly PlantWithSpace[],
  date: CalendarDate,
  utcOffsetMinutes: number,
): WidgetDay {
  // 그날 정오를 기준으로 본다. 자정 언저리의 한두 시간 차이에 흔들리지 않게
  const noon = startOfDay(date, utcOffsetMinutes) + 12 * 60 * 60 * 1000;
  const { overdue, due } = classifyToday(items, noon, utcOffsetMinutes);
  const waiting = [...overdue, ...due];

  const lines = waiting.slice(0, WIDGET_LINES).map(({ plant, soil }) => ({
    name: plant.nickname,
    tag: formatDaysLeft(soil.daysLeft),
    overdue: soil.status === 'overdue',
  }));

  let next: string | null = null;
  if (waiting.length === 0) {
    const upcoming = items
      .filter(({ plant }) => plant.nextWaterAt !== null && plant.nextWaterAt > noon)
      .sort((a, b) => (a.plant.nextWaterAt ?? 0) - (b.plant.nextWaterAt ?? 0))[0];
    if (upcoming?.plant.nextWaterAt) {
      next = ko.widget.next(
        upcoming.plant.nickname,
        formatMonthDay(toCalendarDate(upcoming.plant.nextWaterAt, utcOffsetMinutes)),
      );
    }
  }

  return {
    date: isoDate(date),
    dateLabel: formatDottedDate(date),
    weekday: formatWeekday(date),
    count: waiting.length,
    headline:
      items.length === 0 ? ko.widget.empty : waiting.length > 0 ? ko.widget.headline : ko.widget.none,
    lines,
    more: waiting.length > WIDGET_LINES ? ko.widget.more(waiting.length - WIDGET_LINES) : null,
    next,
  };
}

export function buildWidgetSnapshot(
  items: readonly PlantWithSpace[],
  now: number,
  utcOffsetMinutes: number,
): WidgetSnapshot {
  const today = toCalendarDate(now, utcOffsetMinutes);
  return {
    version: WIDGET_VERSION,
    stale: ko.widget.stale,
    colors: { light: widgetColors(colors.light), dark: widgetColors(colors.dark) },
    days: Array.from({ length: WIDGET_DAYS }, (_, offset) =>
      dayOf(items, addDays(today, offset), utcOffsetMinutes),
    ),
  };
}

/** 저장해 둔 글을 읽는다. 판이 다르거나 모양이 틀리면 null */
export function parseWidgetSnapshot(text: string | null): WidgetSnapshot | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<WidgetSnapshot> | null;
    if (
      value?.version !== WIDGET_VERSION ||
      typeof value.stale !== 'string' ||
      !value.colors?.light ||
      !value.colors.dark ||
      !Array.isArray(value.days)
    ) {
      return null;
    }
    return value as WidgetSnapshot;
  } catch {
    return null;
  }
}

/** 지금 보여 줄 날. 만들어 둔 날을 다 썼으면 null. iOS 위젯은 Swift 에서 같은 일을 한다 */
export function pickWidgetDay(
  snapshot: WidgetSnapshot,
  now: number,
  utcOffsetMinutes: number,
): WidgetDay | null {
  const today = isoDate(toCalendarDate(now, utcOffsetMinutes));
  return snapshot.days.find((day) => day.date === today) ?? null;
}
