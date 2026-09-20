/**
 * 계산 근거를 글로 보여 준다 (SPEC.md 1 "계산 근거 공개", 3.4).
 * 예: "7일 × 가을 1.0 × 중형 1.0 × 중광 1.0 × 보정 1.15 = 8일"
 */
import type {
  CalendarDate,
  IntervalResult,
  LightGrade,
  PotSize,
  Season,
  SoilType,
  SpaceType,
} from '../engine';
import { ko } from '../i18n/ko';

/** 계산에 쓰인 조건의 이름표. 결과에는 숫자만 있어서 따로 받는다 */
export interface FormulaLabels {
  season: Season;
  potSize: PotSize;
  soilType: SoilType;
  lightGrade: LightGrade;
  spaceType: SpaceType;
}

/** 소수 첫째 자리까지는 늘 보이고 둘째 자리까지만 쓴다: 1 → 1.0, 1.15 → 1.15, 0.765 → 0.77 */
export function formatFactor(value: number): string {
  const text = value.toFixed(2);
  return text.endsWith('0') ? text.slice(0, -1) : text;
}

export function formatMonthDay(date: CalendarDate): string {
  return ko.formula.monthDay(date.month, date.day);
}

/** 남은 일수. 오늘은 D-0, 지났으면 밀린 일수 */
export function formatDaysLeft(daysLeft: number): string {
  return daysLeft >= 0 ? ko.formula.dDay(daysLeft) : ko.formula.overdue(-daysLeft);
}

export function formatFormula(result: IntervalResult, labels: FormulaLabels): string {
  if (result.mode !== 'computed') {
    return result.mode === 'hydro' ? ko.formula.hydro(result.days) : ko.formula.manual(result.days);
  }

  const { factors } = result;
  const terms = [
    ko.formula.days(String(factors.base)),
    `${ko.seasonName[labels.season]} ${formatFactor(factors.season)}`,
    `${ko.potSizeName[labels.potSize]} ${formatFactor(factors.pot)}`,
    `${ko.lightGrade[labels.lightGrade]} ${formatFactor(factors.light)}`,
  ];
  // 공간·흙·보정은 1.0 이면 계산에 영향이 없으므로 줄인다 (SPEC 3.4 와 시나리오 A 의 표기).
  if (factors.spaceType !== 1) {
    terms.push(`${ko.spaceTypeName[labels.spaceType]} ${formatFactor(factors.spaceType)}`);
  }
  if (factors.soil !== 1) {
    terms.push(`${ko.soilTypeName[labels.soilType]} ${formatFactor(factors.soil)}`);
  }
  if (factors.learn !== 1) {
    terms.push(`${ko.formula.learn} ${formatFactor(factors.learn)}`);
  }

  return `${terms.join(' × ')} = ${ko.formula.days(String(result.days))}`;
}
