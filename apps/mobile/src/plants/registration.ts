/**
 * 식물 등록 플로우의 상태와 규칙 (SPEC.md 4.2). 화면과 무관한 순수 함수라 Node 에서 테스트한다.
 * 고른 종은 번들 시드에서 왔든 사진 인식·서버 검색에서 왔든 KnownSpecies 로 같게 다룬다 (3-5).
 */
import { BONSAI_GROUPS } from '../db/schema';
import type { BonsaiGroup, NewPhoto, NewPlant } from '../db/schema';
import {
  addDays,
  computeInterval,
  diffDays,
  halfIntervalDays,
  nextWaterDate,
  POT_SIZES,
  SOIL_TYPES,
  GROUP_CODES,
  startOfDay,
  toCalendarDate,
} from '../engine';
import type {
  CalendarDate,
  Coefficients,
  EngineSpace,
  GroupCode,
  IntervalResult,
  PotSize,
  Season,
  SoilType,
} from '../engine';
import { ko } from '../i18n/ko';
import { uniqueName } from '../lib/unique-name';
import { isBoolean, isNullOr, isOneOf, isString, parseJsonObject } from '../lib/validate';

export const PLANT_STEPS = ['photo', 'species', 'pot', 'soil', 'space', 'bonsai', 'finish'] as const;
export type PlantStep = (typeof PLANT_STEPS)[number];

/** SPEC 4.2: 식물 최대 200개, 사진 최대 3장 */
export const MAX_PLANTS = 200;
export const MAX_PLANT_PHOTOS = 3;
export const MAX_NICKNAME_LENGTH = 20;
/** 마지막 물 준 날로 고를 수 있는 가장 먼 과거 (주기 상한과 같다) */
export const MAX_DAYS_AGO = 60;

/** 종을 모를 때 직접 고르는 식물군. 분재군은 6단계의 토글과 수종군이 정한다 (10.2) */
export const SELECTABLE_GROUPS = ['tropical', 'temperate', 'succulent', 'herb'] as const;
export type SelectableGroup = (typeof SELECTABLE_GROUPS)[number];

const MS_PER_HOUR = 3_600_000;

export interface DraftPhoto {
  /** 문서 폴더 기준 상대 경로 */
  path: string;
  width: number;
  height: number;
}

/**
 * 고른 종. 번들 시드에서 고르든 사진 인식·검색으로 서버에서 받든 같은 모양이다 (3-5).
 * 초안에 값을 그대로 담아 두어, 나중에 이어서 할 때 서버를 다시 부르지 않는다.
 */
export interface KnownSpecies {
  scientificName: string;
  nameKo: string;
  groupCode: GroupCode;
  /** 종별 기본 주기(일). 없으면 식물군 기본값 */
  baseInterval: number | null;
  bonsaiGroup: BonsaiGroup | null;
}

export type SpeciesChoice =
  | { kind: 'known'; species: KnownSpecies }
  /** "모르겠어요". 식물군을 고르기 전에는 groupCode 가 null */
  | { kind: 'unknown'; groupCode: SelectableGroup | null };

/** 등록 중인 식물. 중간에 나가도 이어서 할 수 있게 그대로 저장한다 */
export interface PlantDraft {
  id: string;
  step: PlantStep;
  /** 첫 장이 대표 사진 */
  photos: DraftPhoto[];
  species: SpeciesChoice | null;
  potSize: PotSize;
  soilType: SoilType | null;
  spaceId: string | null;
  isBonsai: boolean;
  bonsaiGroup: BonsaiGroup | null;
  /** 사용자가 고친 별명. null 이면 국명을 쓴다 */
  nickname: string | null;
  /** 마지막으로 물 준 날이 며칠 전인가. 0 은 오늘 */
  wateredDaysAgo: number;
  /** 마지막 물 준 날을 모른다. 그러면 오늘로 두고 첫 알림을 I/2일 뒤에 준다 (5.5) */
  wateredUnknown: boolean;
}

export type PlantDraftAction =
  | { type: 'photoAdded'; photo: DraftPhoto }
  | { type: 'photoRemoved'; path: string }
  | { type: 'speciesChosen'; species: KnownSpecies }
  | { type: 'speciesUnknown' }
  | { type: 'groupChosen'; groupCode: SelectableGroup }
  | { type: 'potChosen'; potSize: PotSize }
  | { type: 'soilChosen'; soilType: SoilType }
  | { type: 'spaceChosen'; spaceId: string }
  | { type: 'bonsaiToggled'; isBonsai: boolean }
  | { type: 'bonsaiGroupChosen'; bonsaiGroup: BonsaiGroup }
  | { type: 'nicknameEdited'; nickname: string }
  | { type: 'wateredDaysAgoChanged'; days: number }
  | { type: 'wateredUnknownToggled'; unknown: boolean }
  | { type: 'next' }
  | { type: 'back' };

export function createPlantDraft(id: string): PlantDraft {
  return {
    id,
    step: 'photo',
    photos: [],
    species: null,
    // SPEC 4.2: 화분 기본값 중
    potSize: 'm',
    soilType: null,
    spaceId: null,
    isBonsai: false,
    bonsaiGroup: null,
    nickname: null,
    wateredDaysAgo: 0,
    wateredUnknown: false,
  };
}

function knownOf(draft: PlantDraft): KnownSpecies | undefined {
  return draft.species?.kind === 'known' ? draft.species.species : undefined;
}

/** 저장될 식물군 (10.2). 분재 토글이 켜져 있으면 수종군이 정한다. 아직 정할 수 없으면 null */
export function resolveGroupCode(draft: PlantDraft): GroupCode | null {
  if (draft.isBonsai) {
    if (!draft.bonsaiGroup) return null;
    return draft.bonsaiGroup === 'conifer' ? 'bonsai_conifer' : 'bonsai_deciduous';
  }
  if (draft.species?.kind === 'unknown') return draft.species.groupCode;

  const known = knownOf(draft);
  if (!known) return null;
  // 분재 수종을 분재가 아닌 화분으로 키우면 온대 수목으로 본다
  return known.bonsaiGroup ? 'temperate' : known.groupCode;
}

/**
 * 분재 화분은 작고 얕아 흙이 빨리 마른다. 분재군 기본값이 1.5~2일이라(SPEC 5.1) 종별 값도 이 안쪽이다.
 * 서버의 species-schema.ts 가 같은 값으로 생성본을 거르고, 여기서는 그 전에 기기에 남은 값을 거른다.
 */
export const BONSAI_MAX_BASE_INTERVAL = 3;

/**
 * 종별 기본 주기. 없으면 null 이고 엔진이 식물군 기본값을 쓴다.
 * 일반 종을 분재로(또는 분재 수종을 일반 화분으로) 키우면 종별 값의 전제가 달라지므로 쓰지 않는다.
 */
export function resolveBaseInterval(draft: PlantDraft): number | null {
  const known = knownOf(draft);
  // 일반 종을 분재로(또는 분재 수종을 일반 화분으로) 키우면 종별 값의 전제가 달라지므로 쓰지 않는다
  if (!known || draft.isBonsai !== (known.bonsaiGroup !== null)) return null;
  // 분재 화분에 정원수 기준 주기가 붙어 오면 분재를 말린다. 분재군 기본값으로 간다
  if (draft.isBonsai && known.baseInterval !== null && known.baseInterval > BONSAI_MAX_BASE_INTERVAL) {
    return null;
  }
  return known.baseInterval;
}

/** 저장될 별명: 고쳤으면 그 별명, 아니면 국명(종을 모르면 식물군 이름). 같은 별명이 있으면 번호를 붙인다 */
export function resolveNickname(draft: PlantDraft, existingNicknames: readonly string[]): string {
  if (draft.nickname !== null) return draft.nickname.trim();

  const groupCode = resolveGroupCode(draft);
  const base = knownOf(draft)?.nameKo ?? (groupCode ? ko.groupName[groupCode] : '');
  return base === '' ? '' : uniqueName(base, existingNicknames);
}

function isStepFilled(draft: PlantDraft, step: PlantStep): boolean {
  switch (step) {
    case 'photo':
      return draft.photos.length > 0;
    case 'species':
      return draft.species?.kind === 'known' || (draft.species?.groupCode ?? null) !== null;
    case 'pot':
      return true;
    case 'soil':
      return draft.soilType !== null;
    case 'space':
      return draft.spaceId !== null;
    case 'bonsai':
      return !draft.isBonsai || draft.bonsaiGroup !== null;
    case 'finish': {
      if (draft.nickname === null) return true;
      const length = draft.nickname.trim().length;
      return length > 0 && length <= MAX_NICKNAME_LENGTH;
    }
  }
}

/** 지금 단계의 입력을 마쳐 다음(마지막 단계에서는 저장)으로 갈 수 있는가 */
export function canAdvance(draft: PlantDraft): boolean {
  return isStepFilled(draft, draft.step);
}

/** 등록 화면의 흙 게이지가 차오르는 값 */
export function progressOf(draft: PlantDraft): number {
  return (PLANT_STEPS.indexOf(draft.step) + 1) / PLANT_STEPS.length;
}

export function reducePlantDraft(draft: PlantDraft, action: PlantDraftAction): PlantDraft {
  const index = PLANT_STEPS.indexOf(draft.step);

  switch (action.type) {
    case 'photoAdded':
      return draft.photos.length >= MAX_PLANT_PHOTOS
        ? draft
        : { ...draft, photos: [...draft.photos, action.photo] };
    case 'photoRemoved':
      return { ...draft, photos: draft.photos.filter((photo) => photo.path !== action.path) };
    case 'speciesChosen': {
      // 종 DB 에 수종군이 있으면 분재 토글과 수종군을 자동으로 고른다 (4.2)
      const { bonsaiGroup } = action.species;
      return {
        ...draft,
        species: { kind: 'known', species: action.species },
        isBonsai: bonsaiGroup !== null,
        bonsaiGroup,
      };
    }
    case 'speciesUnknown':
      return {
        ...draft,
        species: { kind: 'unknown', groupCode: null },
        isBonsai: false,
        bonsaiGroup: null,
      };
    case 'groupChosen':
      return { ...draft, species: { kind: 'unknown', groupCode: action.groupCode } };
    case 'potChosen':
      return { ...draft, potSize: action.potSize };
    case 'soilChosen':
      return { ...draft, soilType: action.soilType };
    case 'spaceChosen':
      return { ...draft, spaceId: action.spaceId };
    case 'bonsaiToggled':
      return {
        ...draft,
        isBonsai: action.isBonsai,
        bonsaiGroup: action.isBonsai ? (knownOf(draft)?.bonsaiGroup ?? null) : null,
      };
    case 'bonsaiGroupChosen':
      return { ...draft, bonsaiGroup: action.bonsaiGroup };
    case 'nicknameEdited':
      return { ...draft, nickname: action.nickname };
    case 'wateredDaysAgoChanged':
      return {
        ...draft,
        wateredDaysAgo: Math.min(Math.max(Math.round(action.days), 0), MAX_DAYS_AGO),
        wateredUnknown: false,
      };
    case 'wateredUnknownToggled':
      return { ...draft, wateredUnknown: action.unknown };
    case 'next':
      return canAdvance(draft) && index < PLANT_STEPS.length - 1
        ? { ...draft, step: PLANT_STEPS[index + 1] }
        : draft;
    case 'back':
      return index > 0 ? { ...draft, step: PLANT_STEPS[index - 1] } : draft;
  }
}

export interface WateringPreview {
  result: IntervalResult;
  /** 마지막 물 준 날부터 첫 알림까지의 일수. 모름이면 I/2 */
  days: number;
  lastWatered: CalendarDate;
  nextWater: CalendarDate;
  /** 오늘부터 다음 물주기까지. 음수면 이미 밀렸다 */
  daysLeft: number;
}

/** 등록 마지막 화면의 "첫 물주기 날짜와 계산식" (4.2 완료). 입력이 덜 됐으면 null */
export function previewWatering(
  draft: PlantDraft,
  space: EngineSpace,
  when: { today: CalendarDate; season: Season },
  coefficients: Coefficients,
): WateringPreview | null {
  const groupCode = resolveGroupCode(draft);
  if (!groupCode || !draft.soilType) return null;

  const result = computeInterval(
    {
      groupCode,
      potSize: draft.potSize,
      soilType: draft.soilType,
      learnFactor: coefficients.learning.initial,
      baseInterval: resolveBaseInterval(draft),
    },
    space,
    when.season,
    coefficients,
  );
  const lastWatered = draft.wateredUnknown ? when.today : addDays(when.today, -draft.wateredDaysAgo);
  const days = draft.wateredUnknown ? halfIntervalDays(result) : result.days;
  const nextWater = nextWaterDate(lastWatered, days);

  return { result, days, lastWatered, nextWater, daysLeft: diffDays(when.today, nextWater) };
}

export interface NewPlantContext {
  /** 고른 공간의 빛 등급과 유형 */
  space: EngineSpace;
  existingNicknames: readonly string[];
  now: number;
  /** 기기 시간대의 UTC 오프셋(분). 물주기 날짜는 기기 로컬 날짜로 센다 (SPEC 12.2) */
  utcOffsetMinutes: number;
  /** Asia/Seoul 날짜로 판정한 지금의 계절 */
  season: Season;
  coefficients: Coefficients;
}

/** 초안을 plants 행과 photos 행으로. 입력이 덜 됐으면 null */
export function toNewPlant(
  draft: PlantDraft,
  context: NewPlantContext,
): { plant: NewPlant; photos: NewPhoto[] } | null {
  const today = toCalendarDate(context.now, context.utcOffsetMinutes);
  const preview = previewWatering(
    draft,
    context.space,
    { today, season: context.season },
    context.coefficients,
  );
  const groupCode = resolveGroupCode(draft);
  const complete = PLANT_STEPS.every((step) => isStepFilled(draft, step));
  if (!preview || !groupCode || !complete || !draft.soilType || !draft.spaceId) return null;

  return {
    plant: {
      id: draft.id,
      spaceId: draft.spaceId,
      scientificName: knownOf(draft)?.scientificName ?? null,
      nickname: resolveNickname(draft, context.existingNicknames),
      groupCode,
      potSize: draft.potSize,
      soilType: draft.soilType,
      isBonsai: draft.isBonsai,
      bonsaiGroup: draft.bonsaiGroup,
      baseInterval: resolveBaseInterval(draft),
      learnFactor: context.coefficients.learning.initial,
      // 날짜만 의미가 있으므로 시간대가 조금 어긋나도 날짜가 바뀌지 않게 정오로 둔다
      lastWateredAt: startOfDay(preview.lastWatered, context.utcOffsetMinutes) + 12 * MS_PER_HOUR,
      lastWateredUnknown: draft.wateredUnknown,
      nextWaterAt: startOfDay(preview.nextWater, context.utcOffsetMinutes),
      coverPhotoPath: draft.photos[0].path,
      createdAt: context.now,
    },
    photos: draft.photos.map((photo, index) => ({
      id: `${draft.id}-photo-${index + 1}`,
      plantId: draft.id,
      path: photo.path,
      takenAt: context.now,
      width: photo.width,
      height: photo.height,
    })),
  };
}

function isDraftPhoto(value: unknown): value is DraftPhoto {
  if (typeof value !== 'object' || value === null) return false;
  const photo = value as Record<string, unknown>;
  return (
    isString(photo.path) && typeof photo.width === 'number' && typeof photo.height === 'number'
  );
}

function isKnownSpecies(value: unknown): value is KnownSpecies {
  if (typeof value !== 'object' || value === null) return false;
  const species = value as Record<string, unknown>;
  return (
    isString(species.scientificName) &&
    species.scientificName !== '' &&
    isString(species.nameKo) &&
    isOneOf(GROUP_CODES, species.groupCode) &&
    (species.baseInterval === null || typeof species.baseInterval === 'number') &&
    isNullOr(species.bonsaiGroup, (v): v is BonsaiGroup => isOneOf(BONSAI_GROUPS, v))
  );
}

function isSpeciesChoice(value: unknown): value is SpeciesChoice {
  if (typeof value !== 'object' || value === null) return false;
  const choice = value as Record<string, unknown>;
  if (choice.kind === 'known') return isKnownSpecies(choice.species);
  return (
    choice.kind === 'unknown' &&
    isNullOr(choice.groupCode, (v): v is SelectableGroup => isOneOf(SELECTABLE_GROUPS, v))
  );
}

/** 저장해 둔 초안(JSON)을 되살린다. 없거나 깨졌으면 null 이고, 그러면 처음부터 시작한다 */
export function parsePlantDraft(json: string | null): PlantDraft | null {
  const raw = parseJsonObject(json);
  if (
    !raw ||
    !isString(raw.id) ||
    raw.id === '' ||
    !isOneOf(PLANT_STEPS, raw.step) ||
    !Array.isArray(raw.photos) ||
    raw.photos.length > MAX_PLANT_PHOTOS ||
    !raw.photos.every(isDraftPhoto) ||
    !isNullOr(raw.species, isSpeciesChoice) ||
    !isOneOf(POT_SIZES, raw.potSize) ||
    !isNullOr(raw.soilType, (v): v is SoilType => isOneOf(SOIL_TYPES, v)) ||
    !isNullOr(raw.spaceId, isString) ||
    !isBoolean(raw.isBonsai) ||
    !isNullOr(raw.bonsaiGroup, (v): v is BonsaiGroup => isOneOf(BONSAI_GROUPS, v)) ||
    !isNullOr(raw.nickname, isString) ||
    typeof raw.wateredDaysAgo !== 'number' ||
    !Number.isInteger(raw.wateredDaysAgo) ||
    raw.wateredDaysAgo < 0 ||
    raw.wateredDaysAgo > MAX_DAYS_AGO ||
    !isBoolean(raw.wateredUnknown)
  ) {
    return null;
  }

  const draft: PlantDraft = {
    id: raw.id,
    step: raw.step,
    photos: raw.photos,
    species: raw.species,
    potSize: raw.potSize,
    soilType: raw.soilType,
    spaceId: raw.spaceId,
    isBonsai: raw.isBonsai,
    bonsaiGroup: raw.bonsaiGroup,
    nickname: raw.nickname,
    wateredDaysAgo: raw.wateredDaysAgo,
    wateredUnknown: raw.wateredUnknown,
  };

  // 저장된 단계가 입력보다 앞서 있으면 아직 안 채운 첫 단계로 되돌린다.
  const firstUnfilled = PLANT_STEPS.find((step) => !isStepFilled(draft, step));
  if (firstUnfilled && PLANT_STEPS.indexOf(firstUnfilled) < PLANT_STEPS.indexOf(draft.step)) {
    return { ...draft, step: firstUnfilled };
  }
  return draft;
}
