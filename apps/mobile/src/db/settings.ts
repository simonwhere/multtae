import { eq } from 'drizzle-orm';

import { settings } from './schema';
import type { SettingKey } from './schema';
import type { Database } from './types';

/** settings 의 값. 없으면 null */
export async function getSetting(db: Database, key: SettingKey): Promise<string | null> {
  const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

export async function setSetting(db: Database, key: SettingKey, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSetting(db: Database, key: SettingKey): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
