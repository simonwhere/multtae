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

/** 이벤트의 payload 를 고친다 (진단 결과에 재확인 날짜와 물주기 답을 남길 때) */
export async function updateEventPayload(db: Database, eventId: string, payload: unknown): Promise<void> {
  await db.update(events).set({ payload }).where(eq(events.id, eventId));
}

/** 진단 이벤트 전부, 최근 것부터. 재확인 알림을 짤 때 payload 를 읽는다 (12.1 재확인) */
export async function listDiagnoses(db: Database): Promise<EventWithPlant[]> {
  return db
    .select({ event: events, nickname: plants.nickname })
    .from(events)
    .innerJoin(plants, eq(events.plantId, plants.id))
    .where(eq(events.type, 'diagnose'))
    .orderBy(desc(events.occurredAt));
}
