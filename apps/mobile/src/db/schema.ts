/**
 * 로컬 SQLite 스키마 (SPEC.md 11.1).
 *
 * 사용자 데이터는 기기에만 있다. 시각은 모두 epoch ms 정수, 0/1 컬럼은 boolean 으로 읽는다.
 * JSON 컬럼은 문자열로 저장되고 drizzle 이 직렬화·역직렬화한다.
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import {
  DIRECTIONS,
  GROUP_CODES,
  LIGHT_GRADES,
  LOGGED_SOIL_STATES,
  POT_SIZES,
  SEASONS,
  SOIL_TYPES,
  SPACE_TYPES,
} from '../engine/types';
import type { IntervalFactors } from '../engine/types';

export const LIGHT_SOURCES = ['ai', 'default', 'manual'] as const;
export type LightSource = (typeof LIGHT_SOURCES)[number];

export const BONSAI_GROUPS = ['conifer', 'deciduous', 'flowering'] as const;
export type BonsaiGroup = (typeof BONSAI_GROUPS)[number];

export const WATERING_SOURCES = ['user', 'rain', 'skipped'] as const;
export type WateringSource = (typeof WATERING_SOURCES)[number];

export const EVENT_TYPES = ['fertilize', 'repot', 'diagnose', 'task', 'move', 'note'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SPECIES_SOURCES = ['seed', 'generated'] as const;
export type SpeciesSource = (typeof SPECIES_SOURCES)[number];

/** settings 테이블의 키 */
export const SETTING_KEYS = [
  'notify_time',
  'bonsai_evening_time',
  'bonsai_winter_time',
  'dnd_start',
  'dnd_end',
  'region_code',
  'heating_start',
  'heating_end',
  'season_overrides',
  'onboarding_done',
  'device_id',
  // 등록 플로우를 중간에 나갔을 때 이어서 하기 위한 초안 JSON (SPEC 4)
  'draft_space',
  'draft_plant',
  // 마지막으로 받은 서버 계수 (SPEC 11.2). 서버에 닿지 않을 때 이 값으로 돈다
  'coefficients_cache',
  // 마지막으로 받은 날씨 (SPEC 7.1). 못 받으면 이 값을 쓰고, 48시간이 넘으면 날씨를 끈다
  'weather_cache',
  // 한파·서리 예보 알림을 울리기로 한 새벽과 시각 (SPEC 12.1). 같은 새벽을 두 번 알리지 않는다
  'weather_alert',
  // 오늘 닫은 경고 카드 (SPEC 3.2 "닫기 가능, 당일만 표시")
  'dismissed_cards',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const spaces = sqliteTable('spaces', {
  /** uuid */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** 기기 파일 경로 */
  photoPath: text('photo_path'),
  direction: text('direction', { enum: DIRECTIONS }).notNull(),
  spaceType: text('space_type', { enum: SPACE_TYPES }).notNull(),
  lightGrade: text('light_grade', { enum: LIGHT_GRADES }).notNull(),
  lightSource: text('light_source', { enum: LIGHT_SOURCES }).notNull(),
  /** light-grade 응답 JSON (SPEC 9.2) */
  aiEvidence: text('ai_evidence', { mode: 'json' }),
  createdAt: integer('created_at').notNull(),
});

export const plants = sqliteTable(
  'plants',
  {
    id: text('id').primaryKey(),
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id),
    /** 종 DB 키. 모름이면 null */
    scientificName: text('scientific_name'),
    nickname: text('nickname').notNull(),
    groupCode: text('group_code', { enum: GROUP_CODES }).notNull(),
    potSize: text('pot_size', { enum: POT_SIZES }).notNull(),
    soilType: text('soil_type', { enum: SOIL_TYPES }).notNull(),
    isBonsai: integer('is_bonsai', { mode: 'boolean' }).notNull().default(false),
    bonsaiGroup: text('bonsai_group', { enum: BONSAI_GROUPS }),
    /** U */
    learnFactor: real('learn_factor').notNull().default(1.0),
    /**
     * 종별 기본 주기(일). 등록할 때 고른 종에서 가져와 저장한다 (3-5).
     * null 이면 엔진이 식물군 기본값을 쓴다. 저장해 두어야 오프라인에서도 같은 값으로 센다
     */
    baseInterval: real('base_interval'),
    /** 수동 고정 일수. null 이면 자동 */
    manualInterval: real('manual_interval'),
    /**
     * 주기를 직접 정했거나 그대로 두겠다고 답한 계절. 지금 계절과 다르면
     * "자동으로 돌릴까요?"를 한 번 묻는다 (SPEC 5.5). 자동이면 null
     */
    manualSeason: text('manual_season', { enum: SEASONS }),
    lastWateredAt: integer('last_watered_at').notNull(),
    /**
     * 등록할 때 마지막 물 준 날을 몰라 last_watered_at 에 등록일을 넣어 둔 상태 (SPEC 5.5).
     * 켜져 있는 동안 다음 물주기는 I/2일 뒤(halfIntervalDays)이고, 처음 물을 주면 끈다.
     */
    lastWateredUnknown: integer('last_watered_unknown', { mode: 'boolean' })
      .notNull()
      .default(false),
    /** 계산 결과 캐시 */
    nextWaterAt: integer('next_water_at'),
    lastRepotAt: integer('last_repot_at'),
    /** 연속 미룸 횟수 */
    postponeCount: integer('postpone_count').notNull().default(0),
    coverPhotoPath: text('cover_photo_path'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('plants_space_id_idx').on(table.spaceId),
    index('plants_next_water_at_idx').on(table.nextWaterAt),
  ],
);

export const wateringLogs = sqliteTable(
  'watering_logs',
  {
    id: text('id').primaryKey(),
    plantId: text('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    wateredAt: integer('watered_at').notNull(),
    soilState: text('soil_state', { enum: LOGGED_SOIL_STATES }).notNull(),
    leafDroop: integer('leaf_droop', { mode: 'boolean' }).notNull().default(false),
    source: text('source', { enum: WATERING_SOURCES }).notNull(),
    /** 당시 계산 주기 (통계용) */
    intervalCalc: real('interval_calc'),
    /** 당시 계수 값 */
    factorSnapshot: text('factor_snapshot', { mode: 'json' }).$type<IntervalFactors>(),
    /**
     * 물을 준 때의 예정일(next_water_at). 물 준 날이 이보다 늦으면 밀렸던 것이다 (SPEC 3.5 통계).
     * "내일로" 미룬 날짜가 들어 있어 미룬 것은 밀림으로 세지 않는다. 0004 전의 기록은 null
     */
    dueAt: integer('due_at'),
  },
  (table) => [index('watering_logs_plant_watered_idx').on(table.plantId, table.wateredAt)],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    plantId: text('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    type: text('type', { enum: EVENT_TYPES }).notNull(),
    occurredAt: integer('occurred_at').notNull(),
    payload: text('payload', { mode: 'json' }),
    photoPath: text('photo_path'),
  },
  (table) => [index('events_plant_occurred_idx').on(table.plantId, table.occurredAt)],
);

export const plantTasks = sqliteTable(
  'plant_tasks',
  {
    id: text('id').primaryKey(),
    plantId: text('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    taskCode: text('task_code').notNull(),
    /** 1~12 */
    monthStart: integer('month_start').notNull(),
    /** 1~12. 시작보다 작으면 해를 넘기는 작업이다 (예: 11~2월) */
    monthEnd: integer('month_end').notNull(),
    labelKo: text('label_ko').notNull(),
    /** 완료한 연도. 매년 리셋 */
    doneYear: integer('done_year'),
  },
  (table) => [index('plant_tasks_plant_id_idx').on(table.plantId)],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    plantId: text('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    takenAt: integer('taken_at').notNull(),
    width: integer('width'),
    height: integer('height'),
  },
  (table) => [index('photos_plant_taken_idx').on(table.plantId, table.takenAt)],
);

/** key-value. 키는 SETTING_KEYS, JSON 값은 문자열로 넣는다 */
export const settings = sqliteTable('settings', {
  key: text('key', { enum: SETTING_KEYS }).primaryKey(),
  value: text('value').notNull(),
});

/** 서버 species 행(SPEC 10.1)의 복사본 + fetched_at. 30일 지나면 백그라운드 갱신 */
export const speciesCache = sqliteTable('species_cache', {
  scientificName: text('scientific_name').primaryKey(),
  nameKo: text('name_ko'),
  aliasesKo: text('aliases_ko', { mode: 'json' }).$type<string[]>(),
  groupCode: text('group_code', { enum: GROUP_CODES }).notNull(),
  /** 종별 기본 주기(일). 없으면 식물군 기본값 */
  baseInterval: real('base_interval'),
  bonsaiGroup: text('bonsai_group', { enum: BONSAI_GROUPS }),
  bonsaiTasks: text('bonsai_tasks', { mode: 'json' }),
  care: text('care', { mode: 'json' }),
  fertilizer: text('fertilizer', { mode: 'json' }),
  repotMonths: integer('repot_months'),
  repotSeason: text('repot_season', { mode: 'json' }).$type<number[]>(),
  toxicPet: integer('toxic_pet', { mode: 'boolean' }),
  winterIndoorOk: integer('winter_indoor_ok', { mode: 'boolean' }),
  source: text('source', { enum: SPECIES_SOURCES }).notNull(),
  reviewed: integer('reviewed', { mode: 'boolean' }).notNull().default(false),
  /** 서버 timestamptz 를 ISO 문자열 그대로 */
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
  fetchedAt: integer('fetched_at').notNull(),
});

export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type Plant = typeof plants.$inferSelect;
export type NewPlant = typeof plants.$inferInsert;
export type WateringLog = typeof wateringLogs.$inferSelect;
export type NewWateringLog = typeof wateringLogs.$inferInsert;
export type PlantEvent = typeof events.$inferSelect;
export type NewPlantEvent = typeof events.$inferInsert;
export type PlantTask = typeof plantTasks.$inferSelect;
export type NewPlantTask = typeof plantTasks.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type SpeciesCacheRow = typeof speciesCache.$inferSelect;
export type NewSpeciesCacheRow = typeof speciesCache.$inferInsert;
