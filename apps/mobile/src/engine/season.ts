/**
 * 계절 판정과 전환 (SPEC.md 5.2). 계절 경계는 Asia/Seoul 날짜 기준이다 (SPEC 15).
 */
import { addDays, toSeoulDate } from './calendar';
import { SEASONS } from './types';
import type { CalendarDate, MonthDay, Season, SeasonBounds, SeasonChange } from './types';

/** 윤년 하루까지 덮는 탐색 범위 */
const DAYS_IN_LEAP_YEAR = 366;

/** 같은 해 안에서 날짜 순서를 비교하는 키 */
function monthDayKey({ month, day }: MonthDay): number {
  return month * 100 + day;
}

/**
 * 그 날짜의 계절: 시작일이 그 날짜와 같거나 앞선 계절 중 가장 늦게 시작한 것.
 * 연초처럼 그해에 시작한 계절이 아직 없으면 전해의 마지막 계절이 이어진다.
 * 시작일이 같은 계절이 둘이면 뒤 계절이 이기고 앞 계절은 길이가 0 이다.
 */
export function getSeason(date: MonthDay, bounds: SeasonBounds): Season {
  const today = monthDayKey(date);
  let started: Season | null = null;
  let last: Season = SEASONS[0];

  for (const season of SEASONS) {
    const start = monthDayKey(bounds[season]);
    if (start <= today && (started === null || start >= monthDayKey(bounds[started]))) {
      started = season;
    }
    if (start >= monthDayKey(bounds[last])) {
      last = season;
    }
  }

  return started ?? last;
}

/** 시각(epoch ms)의 계절. Asia/Seoul 날짜로 판정한다 */
export function getSeasonAt(epochMs: number, bounds: SeasonBounds): Season {
  return getSeason(toSeoulDate(epochMs), bounds);
}

/**
 * date 다음 날부터 찾은 첫 계절 전환. date 당일의 전환은 이미 지난 것으로 본다.
 * 모든 계절의 시작일이 같아 전환이 없으면 null.
 */
export function nextSeasonChange(date: CalendarDate, bounds: SeasonBounds): SeasonChange | null {
  const current = getSeason(date, bounds);

  for (let offset = 1; offset <= DAYS_IN_LEAP_YEAR; offset += 1) {
    const day = addDays(date, offset);
    const season = getSeason(day, bounds);
    if (season !== current) {
      return { season, date: day };
    }
  }

  return null;
}
