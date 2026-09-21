/**
 * 생성한 종 정보의 검증 (SPEC.md 10.4). LLM 이 만든 값이라 스키마와 상식을 모두 본다.
 * 통과한 것만 종 DB 에 저장한다. Deno 런타임과 무관한 순수 함수다.
 */
import { z } from 'zod';

const GROUP_CODES = [
  'succulent',
  'tropical',
  'temperate',
  'herb',
  'bonsai_conifer',
  'bonsai_deciduous',
] as const;

const BONSAI_GROUPS = ['conifer', 'deciduous', 'flowering'] as const;

/** 관리 문구는 한국어 두 문장 이내다 (10.1) */
const careText = z.string().trim().min(1).max(200);
const month = z.number().int().min(1).max(12);

const speciesSchema = z.object({
  scientific_name: z.string().trim().min(1).max(200),
  name_ko: z.string().trim().min(1).max(100),
  aliases_ko: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  group_code: z.enum(GROUP_CODES),
  /** 종별 기본 주기(일). 모르면 null 이고 앱이 식물군 기본값을 쓴다 */
  base_interval: z.number().min(0.5).max(30).nullable(),
  bonsai_group: z.enum(BONSAI_GROUPS).nullable(),
  bonsai_tasks: z
    .array(
      z.object({
        task_code: z.string().trim().min(1).max(50),
        month_start: month,
        month_end: month,
        label_ko: z.string().trim().min(1).max(100),
      }),
    )
    .max(20)
    .default([]),
  care: z.object({
    light: careText,
    water: careText,
    humidity: careText,
    temp_min: z.number().min(-30).max(40).nullable(),
    temp_max: z.number().min(-30).max(60).nullable(),
    soil: careText,
  }),
  fertilizer: z
    .object({
      months: z.array(month).max(12),
      interval_weeks: z.number().int().min(1).max(52).nullable(),
      note: z.string().trim().max(200).nullable(),
    })
    .nullable(),
  repot_months: z.number().int().min(1).max(120).nullable(),
  repot_season: z.array(month).max(12).default([]),
  toxic_pet: z.boolean().nullable(),
  winter_indoor_ok: z.boolean().nullable(),
});

export type Species = z.infer<typeof speciesSchema>;

export type ValidationResult =
  | { ok: true; value: Species }
  | { ok: false; reason: string };

/** 스키마는 맞지만 내용이 앞뒤가 안 맞는 경우 (10.4 상식 체크). 맞으면 null */
function senseCheck(species: Species): string | null {
  const { group_code, base_interval, bonsai_group, care, winter_indoor_ok } = species;
  const isBonsai = group_code.startsWith('bonsai_');

  if (group_code === 'succulent' && base_interval !== null && base_interval < 7) {
    return 'succulent 인데 base_interval 이 7일 미만입니다. 다육은 그보다 드물게 줍니다.';
  }
  if (group_code === 'tropical' && winter_indoor_ok === false) {
    return 'tropical 인데 winter_indoor_ok 가 false 입니다. 열대 관엽은 실내에서 겨울을 납니다.';
  }
  if (group_code === 'tropical' && care.temp_min !== null && care.temp_min < 0) {
    return 'tropical 인데 temp_min 이 영하입니다.';
  }
  if (isBonsai !== (bonsai_group !== null)) {
    return 'group_code 와 bonsai_group 이 어긋납니다. 분재 수종이면 둘 다 있어야 합니다.';
  }
  if (care.temp_min !== null && care.temp_max !== null && care.temp_min >= care.temp_max) {
    return 'temp_min 이 temp_max 보다 크거나 같습니다.';
  }
  return null;
}

export function validateSpecies(value: unknown): ValidationResult {
  const parsed = speciesSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, reason: `${first?.path.join('.') || '값'}: ${first?.message ?? '형식이 맞지 않습니다'}` };
  }

  const nonsense = senseCheck(parsed.data);
  return nonsense ? { ok: false, reason: nonsense } : { ok: true, value: parsed.data };
}

/** 검증을 통과한 값을 species 테이블 행으로. 생성본은 사람이 볼 때까지 reviewed=false 다 */
export const GENERATED_SPECIES = (species: Species) => ({
  ...species,
  source: 'generated' as const,
  reviewed: false,
});

/** Claude 가 코드 블록이나 설명을 붙여도 JSON 만 꺼낸다 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1]?.trim() ?? text.trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
