import { COEFFICIENTS_SCHEMA_VERSION } from './types';
import type { Coefficients } from './types';

/**
 * 번들 기본 계수. SPEC.md 5.1~5.4 표의 값 그대로다.
 * 서버 coefficients 를 못 받은 첫 실행 오프라인에서도 이 값으로 동작한다 (SPEC 11.2).
 */
export const DEFAULT_COEFFICIENTS: Coefficients = {
  version: COEFFICIENTS_SCHEMA_VERSION,

  // 5.1 식물군과 기본 주기 B (일)
  baseInterval: {
    succulent: 14,
    tropical: 7,
    temperate: 6,
    herb: 3,
    bonsai_conifer: 2,
    bonsai_deciduous: 1.5,
  },

  // 5.2 계절 계수 S
  season: {
    succulent: { spring: 1.0, monsoon: 1.5, heat: 1.2, autumn: 1.0, winter: 2.5 },
    tropical: { spring: 1.0, monsoon: 1.3, heat: 0.7, autumn: 1.0, winter: 1.6 },
    temperate: { spring: 1.0, monsoon: 1.3, heat: 0.7, autumn: 1.0, winter: 1.8 },
    herb: { spring: 1.0, monsoon: 1.2, heat: 0.5, autumn: 1.0, winter: 1.5 },
    bonsai_conifer: { spring: 1.0, monsoon: 1.3, heat: 0.5, autumn: 1.0, winter: 1.5 },
    bonsai_deciduous: { spring: 1.0, monsoon: 1.2, heat: 0.5, autumn: 1.0, winter: 2.0 },
  },

  // 5.3 화분·빛·공간·흙 계수
  pot: { s: 0.7, m: 1.0, l: 1.3, xl: 1.6 },
  light: { high: 0.8, medium: 1.0, low: 1.3, very_low: 1.6 },
  spaceType: { indoor_window: 1.0, indoor_far: 1.0, balcony_ext: 0.9, terrace: 0.7 },
  soil: { potting: 1.0, gritty: 0.8, akadama: 0.6 },
  hydroFixedDays: 7,

  // 5장 식: 최종값은 1일~60일 사이로 자른다
  intervalClamp: { min: 1, max: 60 },

  // 5.4 학습 보정 U
  learning: {
    initial: 1.0,
    min: 0.5,
    max: 2.0,
    soilState: { wet: 1.15, ok: 1.0, dry: 0.85 },
    leafDroop: 0.9,
    streakNotice: 3,
  },

  // 5.5 "내일로" 미루기: 최대 3회 연속
  maxPostpones: 3,

  // 5.2 계절 경계 (시작일). 겨울은 봄 시작 전날(2월 28일, 윤년 29일)에 끝난다
  seasonBounds: {
    spring: { month: 3, day: 1 },
    monsoon: { month: 6, day: 21 },
    heat: { month: 7, day: 26 },
    autumn: { month: 9, day: 1 },
    winter: { month: 11, day: 16 },
  },
};
