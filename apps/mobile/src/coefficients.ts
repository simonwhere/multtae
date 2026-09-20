import { DEFAULT_COEFFICIENTS } from '@/engine';
import type { Coefficients } from '@/engine';

/** 지금 쓰는 계수. 서버 값과 로컬 캐시는 3-1 에서 붙이고, 그때까지는 번들 기본값이다 (SPEC 11.2) */
export function currentCoefficients(): Coefficients {
  return DEFAULT_COEFFICIENTS;
}
