import { events } from './schema';
import type { NewPlantEvent } from './schema';
import type { Database } from './types';

export async function insertEvent(db: Database, event: NewPlantEvent): Promise<void> {
  await db.insert(events).values(event).onConflictDoNothing({ target: events.id });
}
