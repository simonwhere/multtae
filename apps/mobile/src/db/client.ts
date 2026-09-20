import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'multtae.db';

const sqlite = openDatabaseSync(DATABASE_NAME);
// SQLite 는 연결마다 외래 키 검사를 켜야 한다.
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
