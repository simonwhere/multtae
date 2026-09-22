/**
 * 사진으로 읽은 빛 (SPEC.md 9.2). 서버 응답과 spaces.ai_evidence 에 저장된 값을 같은 함수로 읽는다.
 * 저장된 값은 앱을 고치는 사이에 형식이 어긋날 수 있어 늘 확인하고 쓴다.
 */
import { LIGHT_GRADES } from '../engine';
import type { LightGrade } from '../engine';
import { isBoolean, isOneOf, isString } from '../lib/validate';

export const CURTAINS = ['none', 'sheer', 'blackout'] as const;
export type Curtain = (typeof CURTAINS)[number];

/** 화면에 보여 주는 근거 문장 수 (SPEC 4.1 "근거 문장 2줄") */
export const SHOWN_EVIDENCE = 2;

export interface LightReading {
  grade: LightGrade;
  /** 0~1. 0.5 미만이면 기본값 표를 쓰고 이 결과는 참고로만 보여 준다 */
  confidence: number;
  evidence: string[];
  windowVisible: boolean | null;
  curtain: Curtain | null;
  /** 창까지의 거리(m) */
  distanceM: number | null;
  /** 이 자리에서 알아 둘 점 한 문장 */
  noteKo: string | null;
}

const isRatio = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isDistance = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function orNull<T>(value: unknown, check: (value: unknown) => value is T): T | null {
  return check(value) ? value : null;
}

/**
 * 서버가 준 JSON(스네이크 케이스)이나 저장해 둔 값(카멜 케이스)을 읽는다.
 * 등급과 확신도가 없으면 null 이고, 그러면 방향 × 유형 기본값으로 간다 (4.1).
 */
export function parseLightReading(value: unknown): LightReading | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (!isOneOf(LIGHT_GRADES, raw.grade) || !isRatio(raw.confidence)) return null;

  const note = orNull(raw.noteKo ?? raw.note_ko, isString)?.trim();

  return {
    grade: raw.grade,
    confidence: raw.confidence,
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence
          .filter(isString)
          .map((line) => line.trim())
          .filter((line) => line !== '')
      : [],
    windowVisible: orNull(raw.windowVisible ?? raw.window_visible, isBoolean),
    curtain: orNull(raw.curtain, (v): v is Curtain => isOneOf(CURTAINS, v)),
    distanceM: orNull(raw.distanceM ?? raw.distance_m, isDistance),
    noteKo: note || null,
  };
}

/** 화면에 보여 줄 근거 두 줄 (4.1). 없으면 빈 배열이고 화면은 그 줄을 비운다 */
export function shownEvidence(reading: LightReading | null): string[] {
  return reading ? reading.evidence.slice(0, SHOWN_EVIDENCE) : [];
}
