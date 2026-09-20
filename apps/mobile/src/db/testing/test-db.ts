/**
 * 테스트 전용 DB. 앱이 번들하는 실제 마이그레이션 .sql 을 인메모리 SQLite(node:sqlite)에 적용한다.
 * 앱 코드에서는 import 하지 않는다 (expo-sqlite 가 아니라 Node 내장 모듈을 쓴다, Node 22.13 이상).
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from '../schema';

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

export interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

function readMigrationFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, MIGRATIONS_DIR)), 'utf8');
}

/** drizzle-kit 이 관리하는 마이그레이션 목록 (적용 순서) */
export function readJournal(): JournalEntry[] {
  const journal = JSON.parse(readMigrationFile('meta/_journal.json')) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

export function readMigrationSql(tag: string): string {
  return readMigrationFile(`${tag}.sql`);
}

/** Metro 가 번들하는 진입 파일. 여기서 import 하지 않은 .sql 은 앱에 실리지 않는다 */
export function readMigrationsIndex(): string {
  return readMigrationFile('migrations.js');
}

/** 앱(client.ts)과 같이 외래 키 검사를 켠 빈 인메모리 DB */
export function openTestDatabase(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  return sqlite;
}

/**
 * journal 순서대로 마이그레이션을 적용한다. drizzle 의 expo 마이그레이터처럼 breakpoint 로 문장을 나눈다.
 * from·to 는 journal 인덱스 구간 [from, to) 이고 기본은 전부다.
 */
export function applyMigrations(
  sqlite: DatabaseSync,
  { from = 0, to = Number.POSITIVE_INFINITY }: { from?: number; to?: number } = {},
): void {
  for (const entry of readJournal().slice(from, to)) {
    for (const statement of readMigrationSql(entry.tag).split(STATEMENT_BREAKPOINT)) {
      sqlite.exec(statement);
    }
  }
}

/** 모든 마이그레이션을 적용한 DB 와, 앱과 같은 스키마로 묶은 drizzle 인스턴스 */
export function createTestDb() {
  const sqlite = openTestDatabase();
  applyMigrations(sqlite);

  const db = drizzle(
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql);
      if (method === 'run') {
        statement.run(...params);
        return { rows: [] };
      }
      // setReturnArrays 를 켜면 행이 값 배열로 오지만 node:sqlite 타입은 그것을 모른다.
      statement.setReturnArrays(true);
      const rows = statement.all(...params) as unknown as unknown[][];
      return { rows: method === 'get' ? rows[0] : rows };
    },
    { schema },
  );

  return { sqlite, db };
}

export type TestDb = ReturnType<typeof createTestDb>['db'];
