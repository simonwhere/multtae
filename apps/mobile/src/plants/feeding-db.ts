/**
 * 비료·분갈이 규칙(feeding.ts)에 DB 의 종 정보와 기록을 대어 준다 (SPEC.md 8.2, 8.3).
 */
import { latestEventAt } from '../db/events';
import type { PlantWithSpace } from '../db/plants';
import type { Plant } from '../db/schema';
import { getCachedSpecies } from '../db/species-cache';
import type { Database } from '../db/types';
import { listPlantWaterings } from '../db/watering';
import { toCalendarDate } from '../engine';
import type { Season } from '../engine';
import { fertilizerRule, isFertilizerDue, repotHint, ROOTS_WINDOW } from './feeding';
import type { RepotHint } from './feeding';

export interface FeedingContext {
  now: number;
  utcOffsetMinutes: number;
  season: Season;
}

/** 오늘 물을 주면서 비료도 함께 줄 때인가. 비료 기록이 없으면 등록일부터 센다 */
export async function isFertilizerDueToday(
  db: Database,
  plant: Plant,
  context: FeedingContext,
): Promise<boolean> {
  const { now, utcOffsetMinutes, season } = context;
  const [species, fertilizedAt] = await Promise.all([
    plant.scientificName ? getCachedSpecies(db, plant.scientificName) : Promise.resolve(null),
    latestEventAt(db, plant.id, 'fertilize'),
  ]);

  return isFertilizerDue(
    fertilizerRule(plant, species),
    {
      lastFertilized: toCalendarDate(fertilizedAt ?? plant.createdAt, utcOffsetMinutes),
      lastRepot: plant.lastRepotAt === null ? null : toCalendarDate(plant.lastRepotAt, utcOffsetMinutes),
    },
    toCalendarDate(now, utcOffsetMinutes),
    season,
  );
}

/** 오늘 분갈이를 생각해 볼 식물들 (8.3 오늘 탭 카드) */
export async function repotHints(
  db: Database,
  items: readonly PlantWithSpace[],
  context: Pick<FeedingContext, 'now' | 'utcOffsetMinutes'>,
): Promise<{ plant: Plant; hint: RepotHint }[]> {
  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  const hints: { plant: Plant; hint: RepotHint }[] = [];

  for (const { plant } of items) {
    if (plant.isBonsai || plant.soilType === 'hydro') continue;
    const [species, recent] = await Promise.all([
      plant.scientificName ? getCachedSpecies(db, plant.scientificName) : Promise.resolve(null),
      // 흙 상태를 고르지 않은 기록을 건너뛰므로 넉넉히 읽는다
      listPlantWaterings(db, plant.id, ROOTS_WINDOW * 3),
    ]);
    const hint = repotHint(
      plant,
      species,
      {
        since: toCalendarDate(plant.lastRepotAt ?? plant.createdAt, context.utcOffsetMinutes),
        known: plant.lastRepotAt !== null,
        recent,
      },
      today,
    );
    if (hint) hints.push({ plant, hint });
  }
  return hints;
}
