/**
 * 날씨 규칙 (SPEC.md 7.2)과 계절 카드 (6.3, 7.3, 7.4). 화면·DB 와 무관한 순수 함수다.
 *
 * 테라스·옥외와 발코니 확장(창을 연 상태로 본다)의 식물에만 날씨가 닿는다. 실내 식물은 미세먼지 같은
 * 안내 카드만 받는다. 날씨를 쓸 수 있는지(48시간, 한국 시간)는 부르는 쪽이 보고, 못 쓰면 null 을 넘긴다.
 */
import type { PlantWithSpace } from '../db/plants';
import type { Plant } from '../db/schema';
import { addDays, diffDays, toCalendarDate } from '../engine';
import type { CalendarDate, Coefficients, EngineSpace, Season } from '../engine';
import { planWatering } from '../plants/today';
import type { WateringContext, WateringPlan } from '../plants/today';
import { dateKey, dayOf } from './forecast';
import type { Weather } from './forecast';

/** 7.2 기준값 */
export const RAIN_POP = 70;
export const RAIN_MM = 5;
export const HEAT_C = 33;
export const COLD_C = -5;
export const FROST_C = 3;
export const FROST_MONTHS: readonly number[] = [3, 4, 10, 11];
export const WIND_MS = 10;
/** 이 시각 전이면 오늘 새벽 기온도 아직 올 일로 본다 */
const MORNING_END_HOUR = 9;
const MONDAY = 1;

export interface RuleContext {
  now: number;
  utcOffsetMinutes: number;
  season: Season;
  coefficients: Coefficients;
}

export type WeatherCard =
  | { kind: 'heat'; names: string[] }
  | {
      kind: 'cold';
      when: 'today' | 'tomorrow';
      low: number;
      names: string[];
      /** 바깥 자리에 분재가 있다. 6.3 의 화분 동결 문구를 붙인다 */
      bonsai: boolean;
      /** 발코니 확장에 식물이 있다. 6.3 의 새벽 기온 문구를 붙인다 */
      balcony: boolean;
    }
  | { kind: 'frost'; when: 'today' | 'tomorrow'; low: number; names: string[] }
  | { kind: 'wind'; names: string[]; small: string[] }
  | { kind: 'dust' }
  | { kind: 'humidity' }
  | { kind: 'monsoon' };

export type WeatherCardKind = WeatherCard['kind'];

const isOpenAir = ({ space }: PlantWithSpace) =>
  space.spaceType === 'terrace' || space.spaceType === 'balcony_ext';
const isTerrace = ({ space }: PlantWithSpace) => space.spaceType === 'terrace';
const names = (items: readonly PlantWithSpace[]) => items.map(({ plant }) => plant.nickname);

/**
 * 비가 대신 물을 줄 식물 (7.2): 오늘 강수확률 70% 이상이고 5mm 이상 오면, 테라스에서 오늘까지 물 줄 식물.
 * 밀린 식물도 비를 맞는다. 수경은 흙이 없어 뺀다.
 */
export function rainWatered(
  items: readonly PlantWithSpace[],
  weather: Weather | null,
  context: Pick<RuleContext, 'now' | 'utcOffsetMinutes'>,
): PlantWithSpace[] {
  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  const forecast = dayOf(weather, today);
  if (!forecast || forecast.pop < RAIN_POP || forecast.pcp < RAIN_MM) return [];

  return items.filter(
    (item) =>
      isTerrace(item) &&
      item.plant.soilType !== 'hydro' &&
      item.plant.nextWaterAt !== null &&
      diffDays(toCalendarDate(item.plant.nextWaterAt, context.utcOffsetMinutes), today) >= 0,
  );
}

/** 비로 준 물: 흙을 확인하지 않았으니 배우지 않고, 오늘부터 다시 센다. 기록은 source=rain */
export function planRainWatering(
  plant: Plant,
  space: EngineSpace,
  context: WateringContext,
): WateringPlan {
  const plan = planWatering(plant, space, { soilState: 'skipped', leafDroop: false }, context);
  return { ...plan, log: { ...plan.log, source: 'rain', soilState: 'skipped', leafDroop: false } };
}

function hourOf(now: number, utcOffsetMinutes: number): number {
  return new Date(now + utcOffsetMinutes * 60_000).getUTCHours();
}

/** 다가올 새벽들. 오전 9시 전이면 오늘 새벽도 아직 지나지 않은 것으로 본다 */
function dawnsAhead(
  weather: Weather,
  context: Pick<RuleContext, 'now' | 'utcOffsetMinutes'>,
): { when: 'today' | 'tomorrow'; date: CalendarDate; low: number }[] {
  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  const candidates: { when: 'today' | 'tomorrow'; date: CalendarDate }[] = [
    ...(hourOf(context.now, context.utcOffsetMinutes) < MORNING_END_HOUR
      ? [{ when: 'today' as const, date: today }]
      : []),
    { when: 'tomorrow', date: addDays(today, 1) },
  ];

  return candidates.flatMap(({ when, date }) => {
    const low = dayOf(weather, date)?.tmin;
    return low === null || low === undefined ? [] : [{ when, date, low }];
  });
}

function coldDawn(weather: Weather, context: RuleContext) {
  return dawnsAhead(weather, context).find((dawn) => dawn.low <= COLD_C) ?? null;
}

function frostDawn(weather: Weather, context: RuleContext) {
  return (
    dawnsAhead(weather, context).find(
      (dawn) => dawn.low <= FROST_C && FROST_MONTHS.includes(dawn.date.month),
    ) ?? null
  );
}

/** 오늘 탭 경고 카드 (3.2). 날씨가 없어도 계절 카드(7.3 습도, 7.4 장마 시작)는 뜬다 */
export function weatherCards(
  items: readonly PlantWithSpace[],
  weather: Weather | null,
  context: RuleContext,
): WeatherCard[] {
  if (items.length === 0) return [];

  const cards: WeatherCard[] = [];
  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  const openAir = items.filter(isOpenAir);
  const terrace = items.filter(isTerrace);

  if (weather) {
    const forecast = dayOf(weather, today);

    if (openAir.length > 0 && forecast?.tmax != null && forecast.tmax >= HEAT_C) {
      cards.push({ kind: 'heat', names: names(openAir) });
    }

    const cold = openAir.length > 0 ? coldDawn(weather, context) : null;
    if (cold) {
      cards.push({
        kind: 'cold',
        when: cold.when,
        low: cold.low,
        names: names(openAir),
        bonsai: openAir.some(({ plant }) => plant.isBonsai),
        balcony: openAir.some(({ space }) => space.spaceType === 'balcony_ext'),
      });
    }

    // 한파 카드가 있으면 서리는 따로 말하지 않는다
    const frost = !cold && terrace.length > 0 ? frostDawn(weather, context) : null;
    if (frost) {
      cards.push({ kind: 'frost', when: frost.when, low: frost.low, names: names(terrace) });
    }

    if (terrace.length > 0 && forecast?.windMax != null && forecast.windMax >= WIND_MS) {
      cards.push({
        kind: 'wind',
        names: names(terrace),
        small: names(terrace.filter(({ plant }) => plant.potSize === 's')),
      });
    }

    const dusty = weather.dust === 'bad' || weather.dust === 'very_bad';
    if (dusty && items.some(({ plant }) => plant.groupCode === 'tropical')) {
      cards.push({ kind: 'dust' });
    }
  }

  // 7.3 난방 시즌에는 월요일마다 실내 관엽에 습도 안내
  const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const indoorFoliage = items.some(
    ({ plant, space }) =>
      (space.spaceType === 'indoor_window' || space.spaceType === 'indoor_far') &&
      (plant.groupCode === 'tropical' || plant.groupCode === 'temperate'),
  );
  if (context.season === 'winter' && weekday === MONDAY && indoorFoliage) {
    cards.push({ kind: 'humidity' });
  }

  // 7.4 장마가 시작하는 날
  const monsoon = context.coefficients.seasonBounds.monsoon;
  if (today.month === monsoon.month && today.day === monsoon.day) {
    cards.push({ kind: 'monsoon' });
  }

  return cards;
}

/** 폭염인 날(YYYY-MM-DD). 바깥 자리 식물이 있을 때만 그날 아침 알림을 07시로 당긴다 (7.2) */
export function heatDays(items: readonly PlantWithSpace[], weather: Weather | null): string[] {
  if (!weather || !items.some(isOpenAir)) return [];
  return weather.days.filter((day) => day.tmax !== null && day.tmax >= HEAT_C).map((day) => day.date);
}

export interface WeatherAlert {
  kind: 'cold' | 'frost';
  /** 경고하는 새벽의 날짜 YYYY-MM-DD. 같은 새벽을 두 번 알리지 않는 데 쓴다 */
  targetDate: string;
  low: number;
  /** 챙길 식물 수와 그 가운데 분재 수 */
  count: number;
  bonsai: number;
}

/** 내일 새벽 한파·서리 예보 알림 (12.1). 없으면 null */
export function weatherAlert(
  items: readonly PlantWithSpace[],
  weather: Weather | null,
  context: RuleContext,
): WeatherAlert | null {
  if (!weather) return null;
  const target = addDays(toCalendarDate(context.now, context.utcOffsetMinutes), 1);
  const low = dayOf(weather, target)?.tmin;
  if (low === null || low === undefined) return null;

  const openAir = items.filter(isOpenAir);
  const terrace = items.filter(isTerrace);
  const summary = (kind: 'cold' | 'frost', affected: PlantWithSpace[]): WeatherAlert => ({
    kind,
    targetDate: dateKey(target),
    low,
    count: affected.length,
    bonsai: affected.filter(({ plant }) => plant.isBonsai).length,
  });

  if (low <= COLD_C && openAir.length > 0) return summary('cold', openAir);
  if (low <= FROST_C && FROST_MONTHS.includes(target.month) && terrace.length > 0) {
    return summary('frost', terrace);
  }
  return null;
}
