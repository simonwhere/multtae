import type { DatabaseSync } from 'node:sqlite';

import { getTableName, is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import * as schema from './schema';
import {
  applyMigrations,
  openTestDatabase,
  readJournal,
  readMigrationsIndex,
  readMigrationSql,
} from './testing/test-db';

interface ColumnShape {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  hasDefault: boolean;
}

interface ForeignKeyShape {
  from: string;
  table: string;
  to: string;
  onDelete: string;
}

interface TableShape {
  columns: ColumnShape[];
  indexes: string[];
  foreignKeys: ForeignKeyShape[];
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const byFrom = (a: ForeignKeyShape, b: ForeignKeyShape) => a.from.localeCompare(b.from);

// schema.ts 는 테이블 말고 코드 값 배열도 내보내므로 테이블만 고른다.
const schemaTables = (Object.values(schema) as unknown[]).filter((value): value is SQLiteTable =>
  is(value, SQLiteTable),
);

/** schema.ts 가 말하는 테이블 모양 */
function shapeFromSchema(table: SQLiteTable): TableShape {
  const config = getTableConfig(table);

  return {
    columns: config.columns
      .map((column) => ({
        name: column.name,
        type: column.getSQLType().toLowerCase(),
        notNull: column.notNull,
        primaryKey: column.primary,
        hasDefault: column.hasDefault,
      }))
      .sort(byName),
    indexes: config.indexes.map((index) => index.config.name).sort(),
    foreignKeys: config.foreignKeys
      .map((foreignKey) => {
        const reference = foreignKey.reference();
        return {
          from: reference.columns[0].name,
          table: getTableName(reference.foreignTable),
          to: reference.foreignColumns[0].name,
          onDelete: (foreignKey.onDelete ?? 'no action').toUpperCase(),
        };
      })
      .sort(byFrom),
  };
}

/** 마이그레이션을 적용한 DB 의 실제 테이블 모양 */
function shapeFromDatabase(sqlite: DatabaseSync, tableName: string): TableShape {
  const columns = sqlite
    .prepare('select name, type, "notnull", dflt_value, pk from pragma_table_info(?)')
    .all(tableName) as {
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }[];
  const indexes = sqlite
    .prepare("select name from pragma_index_list(?) where origin = 'c'")
    .all(tableName) as { name: string }[];
  const foreignKeys = sqlite
    .prepare('select "from", "table", "to", on_delete from pragma_foreign_key_list(?)')
    .all(tableName) as { from: string; table: string; to: string; on_delete: string }[];

  return {
    columns: columns
      .map((column) => ({
        name: column.name,
        type: column.type.toLowerCase(),
        notNull: column.notnull === 1,
        primaryKey: column.pk > 0,
        hasDefault: column.dflt_value !== null,
      }))
      .sort(byName),
    indexes: indexes.map((index) => index.name).sort(),
    foreignKeys: foreignKeys
      .map((foreignKey) => ({
        from: foreignKey.from,
        table: foreignKey.table,
        to: foreignKey.to,
        onDelete: foreignKey.on_delete,
      }))
      .sort(byFrom),
  };
}

function tableNames(sqlite: DatabaseSync): string[] {
  const rows = sqlite
    .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
    .all() as { name: string }[];
  return rows.map((row) => row.name).sort();
}

describe('마이그레이션 파일', () => {
  const journal = readJournal();

  it('순번이 이어지고 시각이 뒤로 갈수록 늦다 (drizzle 은 시각으로 적용 여부를 가린다)', () => {
    expect(journal.length).toBeGreaterThan(0);
    journal.forEach((entry, position) => {
      expect(entry.idx).toBe(position);
      if (position > 0) expect(entry.when).toBeGreaterThan(journal[position - 1].when);
    });
  });

  it('journal 의 모든 항목이 .sql 파일로 있고 앱 번들 진입 파일이 import 한다', () => {
    const index = readMigrationsIndex();

    for (const entry of journal) {
      expect(readMigrationSql(entry.tag).trim()).not.toBe('');
      expect(index).toContain(`'./${entry.tag}.sql'`);
    }
  });
});

describe('새 설치: 모든 마이그레이션 적용', () => {
  it('SPEC 11.1 의 테이블 8개가 생긴다', () => {
    const sqlite = openTestDatabase();
    applyMigrations(sqlite);

    expect(tableNames(sqlite)).toEqual([
      'events',
      'photos',
      'plant_tasks',
      'plants',
      'settings',
      'spaces',
      'species_cache',
      'watering_logs',
    ]);
  });

  it('schema.ts 의 테이블이 빠짐없이 마이그레이션에 있다', () => {
    const sqlite = openTestDatabase();
    applyMigrations(sqlite);

    expect(schemaTables.map((table) => getTableName(table)).sort()).toEqual(tableNames(sqlite));
  });

  it.each(schemaTables.map((table) => [getTableName(table), table] as const))(
    '%s: schema.ts 와 마이그레이션 결과가 같다 (스키마를 바꾸면 pnpm db:generate)',
    (tableName, table) => {
      const sqlite = openTestDatabase();
      applyMigrations(sqlite);

      expect(shapeFromDatabase(sqlite, tableName)).toEqual(shapeFromSchema(table));
    },
  );
});

describe('업그레이드: 첫 버전(0000) DB 에 이후 마이그레이션 적용', () => {
  it('마이그레이션이 둘 이상이다', () => {
    expect(readJournal().length).toBeGreaterThanOrEqual(2);
  });

  it('기존 공간·식물·기록이 그대로 남고 새 컬럼은 기본값을 갖는다', () => {
    const sqlite = openTestDatabase();
    applyMigrations(sqlite, { to: 1 });
    sqlite.exec(`
      insert into spaces (id, name, direction, space_type, light_grade, light_source, created_at)
        values ('space-1', '남향 거실 창가', 'S', 'indoor_window', 'high', 'default', 1000);
      insert into plants (id, space_id, nickname, group_code, pot_size, soil_type, learn_factor, last_watered_at, created_at)
        values ('plant-1', 'space-1', '몬스테라', 'tropical', 'm', 'potting', 1.15, 2000, 1000);
      insert into watering_logs (id, plant_id, watered_at, soil_state, source)
        values ('log-1', 'plant-1', 2000, 'wet', 'user');
    `);

    applyMigrations(sqlite, { from: 1 });

    expect(
      sqlite
        .prepare('select nickname, learn_factor, last_watered_unknown from plants')
        .all()
        .map((row) => ({ ...row })),
    ).toEqual([{ nickname: '몬스테라', learn_factor: 1.15, last_watered_unknown: 0 }]);
    expect(sqlite.prepare('select count(*) as n from watering_logs').get()).toMatchObject({ n: 1 });
    expect(sqlite.prepare('select count(*) as n from spaces').get()).toMatchObject({ n: 1 });
  });

  it('0005: 이미 있던 식물·공간은 등록한 때를 마지막으로 고친 때로 채운다 (9-2 합치기)', () => {
    const sqlite = openTestDatabase();
    applyMigrations(sqlite, { to: 5 });
    sqlite.exec(`
      insert into spaces (id, name, direction, space_type, light_grade, light_source, created_at)
        values ('space-1', '남향 거실 창가', 'S', 'indoor_window', 'high', 'default', 1000);
      insert into plants (id, space_id, nickname, group_code, pot_size, soil_type, learn_factor, last_watered_at, created_at)
        values ('plant-1', 'space-1', '몬스테라', 'tropical', 'm', 'potting', 1, 2000, 1500);
    `);

    applyMigrations(sqlite, { from: 5 });

    expect(sqlite.prepare('select updated_at from spaces').get()).toMatchObject({ updated_at: 1000 });
    expect(sqlite.prepare('select updated_at from plants').get()).toMatchObject({ updated_at: 1500 });
  });

  it('업그레이드한 DB 와 새로 설치한 DB 의 모양이 같다', () => {
    const upgraded = openTestDatabase();
    applyMigrations(upgraded, { to: 1 });
    applyMigrations(upgraded, { from: 1 });
    const fresh = openTestDatabase();
    applyMigrations(fresh);

    for (const tableName of tableNames(fresh)) {
      expect(shapeFromDatabase(upgraded, tableName)).toEqual(shapeFromDatabase(fresh, tableName));
    }
  });
});
