/**
 * 진단 결과 (SPEC.md 8.1, 9.3). 서버 응답과 events.payload 에 저장한 값을 같은 함수로 읽는다.
 */
import { isOneOf, isString } from '../lib/validate';

export const WATERING_HINTS = ['over', 'under', 'none'] as const;
export const SEVERITIES = ['low', 'medium', 'high'] as const;

export interface Diagnosis {
  findings: { name: string; confidence: number }[];
  cause: string;
  actions: string[];
  wateringHint: (typeof WATERING_HINTS)[number];
  recheckDays: number;
  severity: (typeof SEVERITIES)[number];
}

const isRatio = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** 서버 응답(스네이크 케이스)이나 저장해 둔 값(카멜 케이스). 모양이 틀리면 null */
export function parseDiagnosis(value: unknown): Diagnosis | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  const hint = raw.wateringHint ?? raw.watering_hint;
  const recheck = raw.recheckDays ?? raw.recheck_days;
  if (
    !Array.isArray(raw.findings) ||
    !isString(raw.cause) ||
    !Array.isArray(raw.actions) ||
    !isOneOf(WATERING_HINTS, hint) ||
    !isOneOf(SEVERITIES, raw.severity) ||
    typeof recheck !== 'number' ||
    !Number.isInteger(recheck) ||
    recheck < 1
  ) {
    return null;
  }

  return {
    findings: raw.findings
      .filter(
        (finding): finding is { name: string; confidence: number } =>
          isString((finding as { name?: unknown })?.name) &&
          isRatio((finding as { confidence?: unknown })?.confidence),
      )
      .map(({ name, confidence }) => ({ name, confidence })),
    cause: raw.cause,
    actions: raw.actions.filter(isString),
    wateringHint: hint,
    recheckDays: recheck,
    severity: raw.severity,
  };
}

export type Likelihood = 'high' | 'medium' | 'low';

/** 확신도를 사람이 읽는 말로. 숫자 대신 "가능성 높음"처럼 보여 준다 */
export function likelihoodOf(confidence: number): Likelihood {
  return confidence >= 0.6 ? 'high' : confidence >= 0.3 ? 'medium' : 'low';
}
