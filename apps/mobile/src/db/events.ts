import { and, desc, eq } from 'drizzle-orm';

import { events, plants } from './schema';
import type { EventType, NewPlantEvent, PlantEvent } from './schema';
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

/** 그 식물의 가장 최근 이벤트 시각. 없으면 null (비료 간격, SPEC 8.2) */
export async function latestEventAt(
  db: Database,
  plantId: string,
  type: EventType,
): Promise<number | null> {
  const rows = await db
    .select({ at: events.occurredAt })
    .from(events)
    .where(and(eq(events.plantId, plantId), eq(events.type, type)))
    .orderBy(desc(events.occurredAt))
    .limit(1);
  return rows[0]?.at ?? null;
}

export async function getEvent(db: Database, eventId: string): Promise<EventWithPlant | null> {
  const rows = await db
    .select({ event: events, nickname: plants.nickname })
    .from(events)
    .innerJoin(plants, eq(events.plantId, plants.id))
    .where(eq(events.id, eventId));
  return rows[0] ?? null;
}
