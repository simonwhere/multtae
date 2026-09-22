/**
 * 방향과 공간 유형으로 정하는 빛 등급 기본값 (SPEC.md 4.1 "AI 실패 시 기본값 표")과
 * AI 판단을 쓸지 정하는 규칙 (9.2).
 */
import type { Direction, LightGrade, SpaceType } from './types';

const DEFAULT_LIGHT_GRADE: Record<Direction, Record<SpaceType, LightGrade>> = {
  S: { indoor_window: 'high', balcony_ext: 'high', terrace: 'high', indoor_far: 'low' },
  E: { indoor_window: 'medium', balcony_ext: 'medium', terrace: 'high', indoor_far: 'low' },
  W: { indoor_window: 'medium', balcony_ext: 'high', terrace: 'high', indoor_far: 'low' },
  N: { indoor_window: 'low', balcony_ext: 'low', terrace: 'medium', indoor_far: 'very_low' },
  unknown: {
    indoor_window: 'medium',
    balcony_ext: 'medium',
    terrace: 'high',
    indoor_far: 'very_low',
  },
};

export function defaultLightGrade(direction: Direction, spaceType: SpaceType): LightGrade {
  return DEFAULT_LIGHT_GRADE[direction][spaceType];
}

/** 이보다 확신이 낮은 AI 판단은 쓰지 않고 참고로만 보여 준다 (9.2) */
export const MIN_LIGHT_CONFIDENCE = 0.5;

/** 사진으로 읽은 빛. 화면에 보여 줄 근거 문장은 여기 말고 spaces 쪽에서 다룬다 */
export interface LightJudgement {
  grade: LightGrade;
  /** 0~1 */
  confidence: number;
}

/** 저장된 빛 등급이 어디서 왔는지. 화면에서 한 줄 설명을 고르는 데 쓴다 */
export type LightSource = 'ai' | 'default' | 'manual';

export function isConfident(judgement: LightJudgement | null | undefined): boolean {
  return judgement != null && judgement.confidence >= MIN_LIGHT_CONFIDENCE;
}

/**
 * 쓸 빛 등급과 그 출처 (4.1, 9.2).
 * 사람이 고친 값이 먼저고, 그다음이 확신이 선 AI 판단, 마지막이 방향 × 유형 기본값이다.
 */
export function resolveLightGrade(input: {
  direction: Direction;
  spaceType: SpaceType;
  ai?: LightJudgement | null;
  manual?: LightGrade | null;
}): { lightGrade: LightGrade; lightSource: LightSource } {
  if (input.manual) return { lightGrade: input.manual, lightSource: 'manual' };
  if (isConfident(input.ai)) {
    return { lightGrade: (input.ai as LightJudgement).grade, lightSource: 'ai' };
  }
  return {
    lightGrade: defaultLightGrade(input.direction, input.spaceType),
    lightSource: 'default',
  };
}
