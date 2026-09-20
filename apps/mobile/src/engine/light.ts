/**
 * 방향과 공간 유형으로 정하는 빛 등급 기본값 (SPEC.md 4.1 "AI 실패 시 기본값 표").
 * AI 판단이 없거나 실패했을 때, 또는 확신도가 0.5 미만일 때 쓴다 (9.2).
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
