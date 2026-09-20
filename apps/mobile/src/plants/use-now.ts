import { currentCoefficients } from '@/coefficients';
import { getSeasonAt } from '@/engine';

/** 지금 시각과 기기 시간대, 계절. 물주기 날짜는 기기 로컬 날짜로, 계절은 Asia/Seoul 날짜로 본다 (SPEC 12.2, 15) */
export function nowContext(now = Date.now()) {
  const coefficients = currentCoefficients();
  return {
    now,
    utcOffsetMinutes: -new Date(now).getTimezoneOffset(),
    season: getSeasonAt(now, coefficients.seasonBounds),
    coefficients,
  };
}
