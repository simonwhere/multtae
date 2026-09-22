/**
 * 알림을 짜기 전에 앞으로 14일을 내다본다: 식물별 물주기 날짜와 그 사이의 계절 전환.
 * 계절이 바뀌면 다음 물주기도 바뀌므로(시나리오 C) 전환일 뒤에 예정된 식물은 새 계절 주기로 미리 센다.
 * 그래야 전환 뒤에 앱을 열지 않아도 알림이 앱이 보여 줄 날짜와 맞는다.
 */
import type { PlantWithSpace } from '../db/plants';
import {
  addDays,
  computeInterval,
  diffDays,
  getSeason,
  nextSeasonChange,
  startOfDay,
  toCalendarDate,
} from '../engine';
import type { Coefficients, Season, SeasonChange } from '../engine';
import { waterDateAsOf } from '../plants/schedule';
import { toEnginePlant } from '../plants/today';
import { SCHEDULE_DAYS } from './plan';
import type { PlanInput, SeasonNotice } from './plan';

export interface ForecastContext {
  now: number;
  /** 기기 시간대의 UTC 오프셋(분) */
  utcOffsetMinutes: number;
  coefficients: Coefficients;
}

/** 새 계절에 내 식물들의 주기 합이 늘어나는가 줄어드는가 */
function trendOf(
  items: readonly PlantWithSpace[],
  from: Season,
  to: Season,
  coefficients: Coefficients,
): SeasonNotice['trend'] {
  const total = (season: Season) =>
    items.reduce(
      (sum, { plant, space }) =>
        sum + computeInterval(toEnginePlant(plant), space, season, coefficients).days,
      0,
    );
  const change = total(to) - total(from);
  return change > 0 ? 'longer' : change < 0 ? 'shorter' : 'same';
}

export function forecast(
  items: readonly PlantWithSpace[],
  context: ForecastContext,
): Pick<PlanInput, 'plants' | 'seasonChanges' | 'season'> {
  const { now, utcOffsetMinutes, coefficients } = context;
  const bounds = coefficients.seasonBounds;
  const today = toCalendarDate(now, utcOffsetMinutes);
  const todaySeason = getSeason(today, bounds);
  if (items.length === 0) return { plants: [], seasonChanges: [], season: todaySeason };

  const lastDay = addDays(today, SCHEDULE_DAYS - 1);

  // 전환일은 달력 날짜 그대로 기기 시간대에서 쓴다 (12.2 시간대)
  const changes: (SeasonChange & { from: Season })[] = [];
  const yesterdaySeason = getSeason(addDays(today, -1), bounds);
  let season = todaySeason;
  // 오늘 바뀐 계절도 알린다. 그래야 오늘 8시 전에 앱을 열어도 그날 알림이 빠지지 않는다
  if (season !== yesterdaySeason) changes.push({ season, date: today, from: yesterdaySeason });

  let cursor = today;
  for (;;) {
    const next = nextSeasonChange(cursor, bounds);
    if (!next || diffDays(next.date, lastDay) < 0) break;
    changes.push({ ...next, from: season });
    season = next.season;
    cursor = next.date;
  }

  const upcoming = changes.filter((change) => diffDays(today, change.date) > 0);
  const plants = items.map(({ plant, space }) => {
    // 저장된 날짜는 오늘의 계절로 센 값이다. 전환일마다 그날 기준으로 다시 세어 본다
    let waterDate = toCalendarDate(plant.nextWaterAt ?? plant.lastWateredAt, utcOffsetMinutes);
    for (const change of upcoming) {
      waterDate = waterDateAsOf(
        { ...plant, nextWaterAt: startOfDay(waterDate, utcOffsetMinutes) },
        space,
        { today: change.date, season: change.season, coefficients, utcOffsetMinutes },
      );
    }
    return {
      nickname: plant.nickname,
      waterDate,
      hydro: plant.soilType === 'hydro',
      bonsai: plant.isBonsai,
      openAir: space.spaceType === 'terrace' || space.spaceType === 'balcony_ext',
    };
  });

  return {
    season: todaySeason,
    plants,
    seasonChanges: changes.map(({ season: to, date, from }) => ({
      season: to,
      date,
      trend: trendOf(items, from, to, coefficients),
    })),
  };
}
