/**
 * 공간 사진으로 빛을 읽는다 (SPEC.md 9.2). 프롬프트와 검증만 있고 Deno 런타임과는 무관하다.
 * 사진은 함수가 도는 동안 메모리에만 있고 어디에도 저장하지 않는다 (CLAUDE.md 절대 규칙).
 */
import { z } from 'zod';

export const LIGHT_GRADES = ['high', 'medium', 'low', 'very_low'] as const;
export const DIRECTIONS = ['S', 'E', 'W', 'N', 'unknown'] as const;
export const SPACE_TYPES = ['indoor_window', 'indoor_far', 'balcony_ext', 'terrace'] as const;
export const CURTAINS = ['none', 'sheer', 'blackout'] as const;

export type LightGrade = (typeof LIGHT_GRADES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type SpaceType = (typeof SPACE_TYPES)[number];

/** 앱은 근거를 두 줄까지 보여 준다 (4.1). 한 줄이 밀릴 때를 보고 하나 더 받아 둔다 */
export const MAX_EVIDENCE = 3;

export interface LightReading {
  grade: LightGrade;
  /** 0~1. 0.5 미만이면 앱이 기본값 표를 쓰고 이 결과는 참고로만 보여 준다 (9.2) */
  confidence: number;
  evidence: string[];
  window_visible: boolean | null;
  curtain: (typeof CURTAINS)[number] | null;
  distance_m: number | null;
  note_ko: string | null;
}

/** 등급과 확신도는 있어야 한다. 나머지는 못 읽으면 비워 두고 그대로 쓴다 */
const requiredSchema = z.object({
  grade: z.enum(LIGHT_GRADES),
  confidence: z.number().min(0).max(1),
});

const optional = <T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/**
 * 앱 문구는 존댓말만 쓴다 (CLAUDE.md). 모델이 "…것이 좋다" 처럼 답할 때가 있어 여기서 걸러낸다.
 * 근거 문장은 "창이 크게 보임" 같은 메모라 이 규칙을 적용하지 않는다 (9.2 예시).
 */
export function isPolite(text: string): boolean {
  return /(요|니다)[.]?$/.test(text.trim());
}

function readEvidence(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, MAX_EVIDENCE);
}

/** 형식이 맞으면 읽은 값, 아니면 null. null 이면 앱이 방향·유형 기본값 표를 쓴다 (4.1) */
export function validateLightReading(value: unknown): LightReading | null {
  const parsed = requiredSchema.safeParse(value);
  if (!parsed.success) return null;

  const raw = value as Record<string, unknown>;
  const note = optional(z.string().trim().min(1).max(200), raw.note_ko);

  return {
    grade: parsed.data.grade,
    confidence: parsed.data.confidence,
    evidence: readEvidence(raw.evidence),
    window_visible: optional(z.boolean(), raw.window_visible),
    curtain: optional(z.enum(CURTAINS), raw.curtain),
    distance_m: optional(z.number().min(0).max(50), raw.distance_m),
    note_ko: note && isPolite(note) ? note : null,
  };
}

export function isDirection(value: unknown): value is Direction {
  return (DIRECTIONS as readonly unknown[]).includes(value);
}

export function isSpaceType(value: unknown): value is SpaceType {
  return (SPACE_TYPES as readonly unknown[]).includes(value);
}

export const SYSTEM_PROMPT = `너는 실내 원예 조명 전문가다. 사진과 메타데이터로 이 위치에 놓인 식물이 받을 빛을 4등급으로 판정한다.

등급 기준:
- high (강광): 직사광이 하루 4시간 이상 드는 위치. 남향 창 바로 앞, 테라스, 커튼 없음
- medium (중광): 밝지만 직사광 2시간 이하. 동·서향 창가, 얇은 커튼, 창에서 50cm~1m
- low (약광): 창에서 1~2m, 북향 창가, 두꺼운 커튼, 건물 가림
- very_low (저광): 창에서 2m 이상, 창이 안 보임, 복도·욕실

판정 방법:
- 사진에서 창의 크기와 위치, 커튼, 식물을 놓을 자리와 창 사이의 거리를 먼저 본다
- 방향과 유형은 참고로만 쓴다. 사진이 그와 어긋나면 사진을 믿고 근거에 적는다
- 창이 보이지 않거나 사진이 어두워 판단이 어려우면 confidence 를 0.5 미만으로 낮춘다

출력 형식(이 JSON 하나만, 다른 텍스트 없음):
{
  "grade": "medium",
  "confidence": 0.78,
  "evidence": ["창이 사진 왼쪽에 크게 보임", "얇은 커튼이 반쯤 쳐짐", "식물 자리는 창에서 약 1m"],
  "window_visible": true,
  "curtain": "sheer",
  "distance_m": 1.0,
  "note_ko": "동향이라 오전에만 직사광이 들어요"
}

- evidence: 사진에서 본 것만 한국어 한 문장씩 최대 3개
- curtain: none, sheer, blackout 중 하나. 모르면 null
- distance_m: 식물을 놓을 자리와 창 사이 거리(m). 모르면 null
- note_ko: 이 자리에서 식물을 키울 때 알아 둘 점 한 문장. 해가 드는 때나 조심할 점을 적고, 등급이나 사진 자체를 말하지 않는다. 느낌표와 이모지 없이 "…요"로 끝나는 존댓말로 쓴다. 예: "한낮 직사광이 강하니 잎이 타지 않는지 살펴 주세요". 없으면 null`;

/** 사진과 함께 보내는 메타데이터 (9.2) */
export function buildLightPrompt(direction: Direction, spaceType: SpaceType): string {
  return `direction: ${direction}
space_type: ${spaceType}

이 사진의 자리에 식물을 놓으면 받을 빛을 판정해라.`;
}

/** 한 번에 넘기는 바이트 수. 한꺼번에 펼치면 인자가 너무 많아 스택이 넘친다 */
const CHUNK = 0x8000;

/** 사진 바이트를 Claude 가 받는 base64 로 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}
