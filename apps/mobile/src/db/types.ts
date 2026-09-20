import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * 저장소 함수가 받는 DB. 앱의 expo-sqlite(동기)와 테스트의 sqlite-proxy(비동기)를 모두 받도록
 * 실행 방식을 가리지 않는다. 그래서 저장소 함수는 쿼리를 늘 await 한다.
 */
export type Database = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;
