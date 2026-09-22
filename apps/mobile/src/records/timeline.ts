/**
 * 기록 탭 타임라인 (SPEC.md 3.5, 8.4). 물주기와 이벤트를 날짜별로 묶는다. 화면·DB 와 떼어 낸 순수 함수다.
 */
import type { EventWithPlant } from '../db/events';
import type { EventType } from '../db/schema';
import type { WateringWithPlant } from '../db/watering';
import { diffDays, POT_SIZES, SOIL_TYPES, toCalendarDate } from '../engine';
import type { CalendarDate, LoggedSoilState, PotSize, SoilType } from '../engine';
import { ko } from '../i18n/ko';
import { withTo } from '../lib/josa';
import { isOneOf } from '../lib/validate';

export type TimelineEntry =
  | {
      kind: 'water';
      id: string;
      plantId: string;
      nickname: string;
      at: number;
      soilState: LoggedSoilState;
      leafDroop: boolean;
      rain: boolean;
    }
  | {
      kind: 'event';
      id: string;
      plantId: string;
      nickname: string;
      at: number;
      type: EventType;
      payload: unknown;
    };

export interface TimelineDay {
  date: CalendarDate;
  entries: TimelineEntry[];
}

/** 물주기와 이벤트를 합쳐 최근 날짜부터 묶는다. plantId 를 주면 그 식물만 */
export function buildTimeline(
  waterings: readonly WateringWithPlant[],
  events: readonly EventWithPlant[],
  utcOffsetMinutes: number,
  plantId: string | null = null,
): TimelineDay[] {
  const entries: TimelineEntry[] = [
    ...waterings.map(
      ({ log, nickname }): TimelineEntry => ({
        kind: 'water',
        id: log.id,
        plantId: log.plantId,
        nickname,
        at: log.wateredAt,
        soilState: log.soilState,
        leafDroop: log.leafDroop,
        rain: log.source === 'rain',
      }),
    ),
    ...events.map(
      ({ event, nickname }): TimelineEntry => ({
        kind: 'event',
        id: event.id,
        plantId: event.plantId,
        nickname,
        at: event.occurredAt,
        type: event.type,
        payload: event.payload,
      }),
    ),
  ]
    .filter((entry) => plantId === null || entry.plantId === plantId)
    .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));

  const days: TimelineDay[] = [];
  for (const entry of entries) {
    const date = toCalendarDate(entry.at, utcOffsetMinutes);
    const last = days.at(-1);
    if (last && diffDays(last.date, date) === 0) last.entries.push(entry);
    else days.push({ date, entries: [entry] });
  }
  return days;
}

const field = (payload: unknown, key: string): unknown =>
  typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)[key] : undefined;

/** 타임라인 한 줄 글. 공간 이동은 옮긴 공간 이름이 필요하다 */
export function entryText(entry: TimelineEntry, spaceNames: ReadonlyMap<string, string>): string {
  const t = ko.records;

  if (entry.kind === 'water') {
    if (entry.rain) return t.rain;
    return [t.watered, t.soilState[entry.soilState], entry.leafDroop ? ko.wateredSheet.leafDroop : '']
      .filter((text) => text !== '')
      .join(', ');
  }

  switch (entry.type) {
    case 'fertilize':
      return t.fertilize;
    case 'repot': {
      const pot = field(entry.payload, 'potSize');
      const soil = field(entry.payload, 'soilType');
      return isOneOf<PotSize>(POT_SIZES, pot) && isOneOf<SoilType>(SOIL_TYPES, soil)
        ? t.repot(ko.potSize[pot], ko.soilType[soil])
        : ko.plantEdit.repot.title;
    }
    case 'diagnose':
      return t.diagnose;
    case 'task': {
      const label = field(entry.payload, 'labelKo');
      return typeof label === 'string' && label !== '' ? t.task(label) : t.taskUnknown;
    }
    case 'move': {
      const to = field(entry.payload, 'toSpaceId');
      const name = typeof to === 'string' ? spaceNames.get(to) : undefined;
      return name ? t.move(withTo(name)) : t.moveUnknown;
    }
    case 'note':
      return field(entry.payload, 'kind') === 'water_cloudy' ? t.waterCloudy : t.note;
  }
}

/** 날짜 제목 "9월 22일 화요일" */
export function dayTitle(date: CalendarDate): string {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return ko.records.day(date.month, date.day, ko.today.weekday[weekday]);
}
