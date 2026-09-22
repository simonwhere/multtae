import { desc, eq } from 'drizzle-orm';

import { events, plants } from './schema';
import type { NewPlantEvent, PlantEvent } from './schema';
import type { Database } from './types';

export async function insertEvent(db: Database, event: NewPlantEvent): Promise<void> {
  await db.insert(events).values(event).onConflictDoNothing({ target: events.id });
}

export interface EventWithPlant {
  event: PlantEvent;
  nickname: string;
}

/** 최근 이벤트부터 (기록 탭 타임라인, SPEC 3.5) */
export async function listRecentEvents(db: Database, limit: number): Promise<EventWithPlant[]> {
  return db
    .select({ event: events, nickname: plants.nickname })
    .from(events)
    .innerJoin(plants, eq(events.plantId, plants.id))
    .orderBy(desc(events.occurredAt), desc(events.id))
    .limit(limit);
}
