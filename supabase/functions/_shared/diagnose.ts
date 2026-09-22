/**
 * 병해충·상태 진단 (SPEC.md 8.1, 9.3). 프롬프트와 응답 검증만 있고 Deno 런타임과는 무관하다.
 * 사진은 함수가 도는 동안 메모리에만 있고 어디에도 저장하지 않는다 (CLAUDE.md 절대 규칙).
 */
import { z } from 'zod';

import { isPolite } from './light.ts';

export const MAX_IMAGES = 3;
export const MAX_FINDINGS = 2;
export const MAX_ACTIONS = 3;
export const WATERING_HINTS = ['over', 'under', 'none'] as const;
export const SEVERITIES = ['low', 'medium', 'high'] as const;

export interface Diagnosis {
  findings: { name: string; confidence: number }[];
  cause: string;
  actions: string[];
  watering_hint: (typeof WATERING_HINTS)[number];
  recheck_days: number;
  severity: (typeof SEVERITIES)[number];
}

const schema = z.object({
  findings: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(5),
  cause: z.string().trim().min(1).max(200),
  actions: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
  watering_hint: z.enum(WATERING_HINTS),
  recheck_days: z.number().int().min(1).max(30),
  severity: z.enum(SEVERITIES),
});

export type DiagnosisResult = { ok: true; value: Diagnosis } | { ok: false; reason: string };

/**
 * 앱 문구에는 대시 문장부호를 쓰지 않는다 (CLAUDE.md). 모델이 "2-3cm"처럼 범위를 붙임표로 쓰면
 * 물결표로 바꾸고, 문장 사이의 긴 대시는 쉼표로 바꾼다.
 */
export function tidy(text: string): string {
  return text
    .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1~$2')
    .replace(/\s*[—–]\s*/g, ', ')
    .trim();
}

function tidyDiagnosis(diagnosis: Diagnosis): Diagnosis {
  return {
    ...diagnosis,
    findings: diagnosis.findings.map((finding) => ({ ...finding, name: tidy(finding.name) })),
    cause: tidy(diagnosis.cause),
    actions: diagnosis.actions.map(tidy),
  };
}

/**
 * 모양과 문구를 본다. 앱 문구는 존댓말만 쓰므로(CLAUDE.md) 원인과 할 일이 존댓말이 아니면 이유를 돌려주고
 * 한 번 더 만들게 한다. 진단명은 "응애"처럼 이름이라 문장 규칙을 적용하지 않는다.
 */
export function validateDiagnosis(value: unknown): DiagnosisResult {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, reason: `${first?.path.join('.') || '값'}: ${first?.message ?? '형식이 맞지 않습니다'}` };
  }

  const diagnosis: Diagnosis = {
    ...parsed.data,
    // 확신이 높은 것부터 두 개까지
    findings: [...parsed.data.findings]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_FINDINGS),
    actions: parsed.data.actions.slice(0, MAX_ACTIONS),
  };

  const impolite = [diagnosis.cause, ...diagnosis.actions].find((line) => !isPolite(line));
  if (impolite) {
    return { ok: false, reason: `"${impolite}" 가 존댓말(…요)로 끝나지 않습니다.` };
  }
  return { ok: true, value: tidyDiagnosis(diagnosis) };
}

/** 문구 규칙만 어겼을 때 두 번째에는 받아 준다. 틀린 모양은 받지 않는다 */
export function validateDiagnosisLoosely(value: unknown): Diagnosis | null {
  const strict = validateDiagnosis(value);
  if (strict.ok) return strict.value;

  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;
  return tidyDiagnosis({
    ...parsed.data,
    findings: [...parsed.data.findings].sort((a, b) => b.confidence - a.confidence).slice(0, MAX_FINDINGS),
    actions: parsed.data.actions.slice(0, MAX_ACTIONS),
  });
}

export const SYSTEM_PROMPT = `너는 가정 원예 병해충 상담사다. 확신 없는 것은 확신 없다고 말하고, 가정에서 할 수 있는 조치만 제안한다. 농약은 시판 가정용 제품명 없이 성분 계열만 언급한다.

사진과 식물 정보, 최근 물주기 기록을 보고 식물의 상태를 판단한다.

출력 형식(이 JSON 하나만, 다른 텍스트 없음):
{
  "findings": [
    {"name": "과습성 뿌리 손상 의심", "confidence": 0.6},
    {"name": "응애", "confidence": 0.3}
  ],
  "cause": "잎 아래쪽부터 노랗게 변하고 흙이 계속 젖어 있어요",
  "actions": ["흙이 완전히 마를 때까지 물을 멈춰 주세요", "화분을 빼서 뿌리가 갈색으로 무르지 않았는지 봐 주세요", "바람이 잘 통하는 곳으로 옮겨 주세요"],
  "watering_hint": "over",
  "recheck_days": 5,
  "severity": "medium"
}

- findings: 의심되는 문제 최대 2개, 이름은 짧게(예: "응애", "과습", "잎 끝 마름"). 뚜렷한 문제가 없으면 빈 배열
- confidence: 0~1. 사진이 흐리거나 부위가 안 보이면 낮춘다
- cause: 사진과 기록에서 본 근거 한 문장. 존댓말 "…요"로 끝낸다
- actions: 지금 할 일 3개, 한 문장씩. 존댓말 "…주세요"로 끝낸다. 느낌표와 이모지는 쓰지 않는다
- 범위는 "2~3cm"처럼 물결표로 쓰고, 대시(-, —)는 쓰지 않는다
- watering_hint: 물을 너무 자주 줬으면 over, 너무 드물게 줬으면 under, 아니면 none
- recheck_days: 다시 볼 날까지 일수 (1~30)
- severity: low, medium, high. 빨리 손쓰지 않으면 식물이 죽을 만하면 high`;

export interface DiagnoseInput {
  /** 종 이름. 모르면 null */
  species: string | null;
  groupCode: string;
  /** 최근 물주기, 최근 것부터 최대 5건 */
  recent: { date: string; soilState: string; leafDroop: boolean }[];
}

const SOIL_WORDS: Record<string, string> = {
  dry: '바싹 말랐음',
  ok: '적당했음',
  wet: '아직 축축했음',
  skipped: '확인 안 함',
};

export function buildDiagnosePrompt(input: DiagnoseInput, rejectedReason: string | null = null): string {
  const waterings =
    input.recent.length === 0
      ? '기록 없음'
      : input.recent
          .slice(0, 5)
          .map(
            (log) =>
              `- ${log.date}: 흙 ${SOIL_WORDS[log.soilState] ?? log.soilState}${log.leafDroop ? ', 잎이 처짐' : ''}`,
          )
          .join('\n');

  return [
    `종: ${input.species ?? '모름'}`,
    `식물군: ${input.groupCode}`,
    `최근 물주기(최근 것부터):\n${waterings}`,
    rejectedReason ? `앞선 답이 거부됐다. 이유: ${rejectedReason} 고쳐서 다시 답해라.` : null,
    '사진 속 식물의 상태를 진단해라.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n\n');
}

/** 앱이 보낸 최근 물주기(JSON 문자열)를 읽는다. 이상하면 빈 배열 */
export function parseRecent(value: unknown): DiagnoseInput['recent'] {
  if (typeof value !== 'string') return [];
  try {
    const raw = JSON.parse(value);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (log): log is { date: string; soilState: string; leafDroop: boolean } =>
          typeof log?.date === 'string' &&
          typeof log?.soilState === 'string' &&
          typeof log?.leafDroop === 'boolean',
      )
      .slice(0, 5)
      .map(({ date, soilState, leafDroop }) => ({
        date: date.slice(0, 10),
        soilState: soilState.slice(0, 10),
        leafDroop,
      }));
  } catch {
    return [];
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** 기기 id 는 해시로만 센다 (11.3). 원래 값은 저장하지 않는다 */
export async function hashDeviceId(deviceId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceId.toLowerCase()));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
