/**
 * 공간 등록 플로우의 상태와 규칙 (SPEC.md 4.1). 화면과 무관한 순수 함수라 Node 에서 테스트한다.
 * 빛은 사진으로 읽은 결과를 먼저 쓰고, 없거나 확신이 낮으면 방향 × 유형 기본값 표로 간다 (9.2).
 */
import type { NewSpace } from '../db/schema';
import { resolveLightGrade } from '../engine/light';
import type { LightSource } from '../engine/light';
import { DIRECTIONS, LIGHT_GRADES, SPACE_TYPES } from '../engine/types';
import type { Direction, LightGrade, SpaceType } from '../engine/types';
import { ko } from '../i18n/ko';
import { uniqueName } from '../lib/unique-name';
import { isNullOr, isOneOf, isString, parseJsonObject } from '../lib/validate';
import { parseLightReading } from './light-reading';
import type { LightReading } from './light-reading';

export const SPACE_STEPS = ['photo', 'direction', 'type', 'light', 'name'] as const;
export type SpaceStep = (typeof SPACE_STEPS)[number];

/** SPEC 4.1: 공간 최대 20개 */
export const MAX_SPACES = 20;
export const MAX_SPACE_NAME_LENGTH = 20;

/** 등록 중인 공간. 중간에 나가도 이어서 할 수 있게 그대로 저장한다 */
export interface SpaceDraft {
  /** 저장될 공간의 id. 사진 파일 이름에도 쓴다 */
  id: string;
  step: SpaceStep;
  /** 문서 폴더 기준 상대 경로 */
  photoPath: string | null;
  direction: Direction | null;
  spaceType: SpaceType | null;
  /** 사진으로 읽은 빛 (9.2). 아직 묻지 않았거나 읽지 못했으면 null */
  aiLight: LightReading | null;
  /** 사용자가 고친 빛 등급. null 이면 사진이나 기본값 표를 따른다 */
  manualLightGrade: LightGrade | null;
  /** 사용자가 고친 이름. null 이면 자동 제안을 쓴다 */
  name: string | null;
}

export type SpaceDraftAction =
  | { type: 'photoPicked'; photoPath: string }
  | { type: 'directionChosen'; direction: Direction }
  | { type: 'typeChosen'; spaceType: SpaceType }
  /** 사진을 읽은 결과. 읽지 못했으면 null */
  | { type: 'lightRead'; reading: LightReading | null }
  | { type: 'lightGradeChosen'; lightGrade: LightGrade }
  | { type: 'nameEdited'; name: string }
  | { type: 'next' }
  | { type: 'back' };

export function createSpaceDraft(id: string): SpaceDraft {
  return {
    id,
    step: 'photo',
    photoPath: null,
    direction: null,
    spaceType: null,
    aiLight: null,
    manualLightGrade: null,
    name: null,
  };
}

function isStepFilled(draft: SpaceDraft, step: SpaceStep): boolean {
  switch (step) {
    case 'photo':
      return draft.photoPath !== null;
    case 'direction':
      return draft.direction !== null;
    case 'type':
      return draft.spaceType !== null;
    case 'light':
      return true;
    case 'name': {
      if (draft.name === null) return true;
      const length = draft.name.trim().length;
      return length > 0 && length <= MAX_SPACE_NAME_LENGTH;
    }
  }
}

/** 지금 단계의 입력을 마쳐 다음(마지막 단계에서는 저장)으로 갈 수 있는가 */
export function canAdvance(draft: SpaceDraft): boolean {
  return isStepFilled(draft, draft.step);
}

/** 등록 화면의 흙 게이지가 차오르는 값 */
export function progressOf(draft: SpaceDraft): number {
  return (SPACE_STEPS.indexOf(draft.step) + 1) / SPACE_STEPS.length;
}

export function reduceSpaceDraft(draft: SpaceDraft, action: SpaceDraftAction): SpaceDraft {
  const index = SPACE_STEPS.indexOf(draft.step);

  switch (action.type) {
    case 'photoPicked':
      // 사진이 바뀌면 그 사진으로 읽은 빛도 버리고 다시 읽는다
      return action.photoPath === draft.photoPath
        ? draft
        : { ...draft, photoPath: action.photoPath, aiLight: null };
    case 'directionChosen':
      // 정해지는 등급이 달라지므로 읽은 값과 고친 등급을 버린다
      return action.direction === draft.direction
        ? draft
        : { ...draft, direction: action.direction, aiLight: null, manualLightGrade: null };
    case 'typeChosen':
      return action.spaceType === draft.spaceType
        ? draft
        : { ...draft, spaceType: action.spaceType, aiLight: null, manualLightGrade: null };
    case 'lightRead':
      return action.reading === draft.aiLight ? draft : { ...draft, aiLight: action.reading };
    case 'lightGradeChosen': {
      // 고른 값이 가만히 두었을 때와 같으면 고치지 않은 것으로 본다
      const automatic = resolveAutomaticLight(draft)?.lightGrade ?? null;
      return {
        ...draft,
        manualLightGrade: action.lightGrade === automatic ? null : action.lightGrade,
      };
    }
    case 'nameEdited':
      return { ...draft, name: action.name };
    case 'next':
      return canAdvance(draft) && index < SPACE_STEPS.length - 1
        ? { ...draft, step: SPACE_STEPS[index + 1] }
        : draft;
    case 'back':
      return index > 0 ? { ...draft, step: SPACE_STEPS[index - 1] } : draft;
  }
}

/** 사람이 고치기 전의 빛 등급. 방향이나 유형이 아직 없으면 null */
function resolveAutomaticLight(
  draft: SpaceDraft,
): { lightGrade: LightGrade; lightSource: LightSource } | null {
  if (!draft.direction || !draft.spaceType) return null;

  return resolveLightGrade({
    direction: draft.direction,
    spaceType: draft.spaceType,
    ai: draft.aiLight,
  });
}

/** 저장될 빛 등급과 그 출처 (4.1, 9.2). 방향이나 유형이 아직 없으면 null */
export function resolveLight(
  draft: SpaceDraft,
): { lightGrade: LightGrade; lightSource: LightSource } | null {
  if (!draft.direction || !draft.spaceType) return null;

  return resolveLightGrade({
    direction: draft.direction,
    spaceType: draft.spaceType,
    ai: draft.aiLight,
    manual: draft.manualLightGrade,
  });
}

/** "남향 실내 창가" 처럼 짓고, 같은 이름이 있으면 번호를 붙인다 */
export function suggestSpaceName(
  direction: Direction,
  spaceType: SpaceType,
  existingNames: readonly string[],
): string {
  const typeName = ko.spaceTypeName[spaceType];
  const base = direction === 'unknown' ? typeName : `${ko.directionName[direction]} ${typeName}`;

  return uniqueName(base, existingNames);
}

/** 저장될 이름: 사용자가 고쳤으면 그 이름, 아니면 자동 제안. 아직 정할 수 없으면 빈 문자열 */
export function resolveSpaceName(draft: SpaceDraft, existingNames: readonly string[]): string {
  if (draft.name !== null) return draft.name.trim();
  if (!draft.direction || !draft.spaceType) return '';
  return suggestSpaceName(draft.direction, draft.spaceType, existingNames);
}

/** 초안을 spaces 행으로. 입력이 덜 됐으면 null */
export function toNewSpace(
  draft: SpaceDraft,
  existingNames: readonly string[],
  now: number,
): NewSpace | null {
  const light = resolveLight(draft);
  const complete = SPACE_STEPS.every((step) => isStepFilled(draft, step));
  if (!light || !complete || !draft.direction || !draft.spaceType) return null;

  return {
    id: draft.id,
    name: resolveSpaceName(draft, existingNames),
    photoPath: draft.photoPath,
    direction: draft.direction,
    spaceType: draft.spaceType,
    lightGrade: light.lightGrade,
    lightSource: light.lightSource,
    // 확신이 낮아 쓰지 않은 판단도 남긴다. 공간 상세에서 참고 문구로 보여 준다 (3.3, 9.2)
    aiEvidence: draft.aiLight,
    createdAt: now,
  };
}

/** 저장해 둔 초안(JSON)을 되살린다. 없거나 깨졌으면 null 이고, 그러면 처음부터 시작한다 */
export function parseSpaceDraft(json: string | null): SpaceDraft | null {
  const raw = parseJsonObject(json);
  if (
    !raw ||
    !isString(raw.id) ||
    raw.id === '' ||
    !isOneOf(SPACE_STEPS, raw.step) ||
    !isNullOr(raw.photoPath, isString) ||
    !isNullOr(raw.direction, (v): v is Direction => isOneOf(DIRECTIONS, v)) ||
    !isNullOr(raw.spaceType, (v): v is SpaceType => isOneOf(SPACE_TYPES, v)) ||
    !isNullOr(raw.manualLightGrade, (v): v is LightGrade => isOneOf(LIGHT_GRADES, v)) ||
    !isNullOr(raw.name, isString)
  ) {
    return null;
  }

  const draft: SpaceDraft = {
    id: raw.id,
    step: raw.step,
    photoPath: raw.photoPath,
    direction: raw.direction,
    spaceType: raw.spaceType,
    // 읽어 둔 빛이 깨졌으면 없는 것으로 본다. 화면이 다시 읽는다
    aiLight: parseLightReading(raw.aiLight),
    manualLightGrade: raw.manualLightGrade,
    name: raw.name,
  };

  // 저장된 단계가 입력보다 앞서 있으면 아직 안 채운 첫 단계로 되돌린다.
  const firstUnfilled = SPACE_STEPS.find((step) => !isStepFilled(draft, step));
  if (firstUnfilled && SPACE_STEPS.indexOf(firstUnfilled) < SPACE_STEPS.indexOf(draft.step)) {
    return { ...draft, step: firstUnfilled };
  }
  return draft;
}
