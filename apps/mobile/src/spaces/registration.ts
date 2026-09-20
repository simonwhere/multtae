/**
 * 공간 등록 플로우의 상태와 규칙 (SPEC.md 4.1). 화면과 무관한 순수 함수라 Node 에서 테스트한다.
 * 2-1 은 AI 없이 방향 × 유형 기본값 표로 빛 등급을 정한다. AI 연결은 4-1.
 */
import type { NewSpace } from '../db/schema';
import { defaultLightGrade } from '../engine/light';
import { DIRECTIONS, LIGHT_GRADES, SPACE_TYPES } from '../engine/types';
import type { Direction, LightGrade, SpaceType } from '../engine/types';
import { ko } from '../i18n/ko';
import { uniqueName } from '../lib/unique-name';
import { isNullOr, isOneOf, isString, parseJsonObject } from '../lib/validate';

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
  /** 사용자가 고친 빛 등급. null 이면 기본값 표를 따른다 */
  manualLightGrade: LightGrade | null;
  /** 사용자가 고친 이름. null 이면 자동 제안을 쓴다 */
  name: string | null;
}

export type SpaceDraftAction =
  | { type: 'photoPicked'; photoPath: string }
  | { type: 'directionChosen'; direction: Direction }
  | { type: 'typeChosen'; spaceType: SpaceType }
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
      return { ...draft, photoPath: action.photoPath };
    case 'directionChosen':
      // 기본값이 달라지므로 고친 등급은 버린다
      return action.direction === draft.direction
        ? draft
        : { ...draft, direction: action.direction, manualLightGrade: null };
    case 'typeChosen':
      return action.spaceType === draft.spaceType
        ? draft
        : { ...draft, spaceType: action.spaceType, manualLightGrade: null };
    case 'lightGradeChosen': {
      const fallback =
        draft.direction && draft.spaceType
          ? defaultLightGrade(draft.direction, draft.spaceType)
          : null;
      return {
        ...draft,
        manualLightGrade: action.lightGrade === fallback ? null : action.lightGrade,
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

/** 빛 등급과 그 출처. 방향이나 유형이 아직 없으면 null */
export function resolveLight(
  draft: SpaceDraft,
): { lightGrade: LightGrade; lightSource: 'default' | 'manual' } | null {
  if (!draft.direction || !draft.spaceType) return null;

  return draft.manualLightGrade
    ? { lightGrade: draft.manualLightGrade, lightSource: 'manual' }
    : { lightGrade: defaultLightGrade(draft.direction, draft.spaceType), lightSource: 'default' };
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
