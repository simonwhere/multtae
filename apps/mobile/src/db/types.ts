import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * 저장소 함수가 받는 DB. 앱의 expo-sqlite(동기)와 테스트의 sqlite-proxy(비동기)를 모두 받도록
 * 실행 방식을 가리지 않는다. 그래서 저장소 함수는 쿼리를 늘 await 한다.
 */
export type Database = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

/** 식물·공간을 고칠 때 (9-2) */
export interface UpdateOptions {
  /**
   * 사람이 고친 것이면 true(기본)라 updatedAt 을 새로 적는다. 가족과 나눈 파일을 합칠 때 이 시각으로
   * 어느 쪽이 최근인지 본다. 알림을 다시 짜며 저절로 바뀐 것(다음 물주기, 비)은 false 로 넘긴다
   */
  touch?: boolean;
  /** 고친 시각. 테스트에서 넣는다 */
  now?: number;
}
