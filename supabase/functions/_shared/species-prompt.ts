/**
 * 종 정보 생성 프롬프트 (SPEC.md 10.2 식물군 매핑, 10.3 프롬프트).
 * 문구를 여기 모아 두어 스크립트(scripts/seed-species.ts)와 Edge Function 이 같은 것을 쓴다.
 */

export const SYSTEM_PROMPT = [
  '너는 한국 실내 원예 전문가다.',
  '아래 학명의 식물을 한국 아파트에서 키우는 기준으로 정보를 JSON 으로만 답한다.',
  '설명이나 코드 블록 없이 JSON 객체 하나만 출력한다.',
  '모르는 항목은 null 로 둔다. 지어내지 않는다.',
  '물주기는 봄·중광·13~20cm 화분·배양토 기준 일수다.',
  'care 의 글은 존댓말로 두 문장 이내, 느낌표와 이모지 없이 쓴다.',
].join(' ');

/** 10.2 식물군 매핑 규칙. 우선순위가 높은 것부터 본다 */
const GROUP_RULES = [
  '1. 한국에서 주로 분재로 유통되고 일반 화분으로는 거의 키우지 않는 수종일 때만 bonsai_conifer(침엽) 또는 bonsai_deciduous(그 밖)로 하고 bonsai_group 을 conifer/deciduous/flowering 중에 고른다.',
  '   소나무, 곰솔, 향나무, 진백, 주목, 단풍, 소사, 느티, 명자, 모과, 철쭉이 그런 수종이다.',
  '   분재로도 쓰이지만 일반 화분이나 정원수로 더 흔하면 분재가 아니다: 율마, 벤자민, 올리브, 회양목, 사철나무, 석류, 동백.',
  '2. 다육질 잎·줄기, 선인장과, 아가베·알로에·산세베리아는 succulent.',
  '3. 원산지가 열대·아열대 우림이고 실내 최저 10도 이상이 필요하면 tropical.',
  '4. 지중해·온대 원산 목본이고 실내 최저 0~5도를 견디면 temperate.',
  '5. 한두 해 사는 초본, 식용·향료, 화단 초화는 herb.',
  '6. 애매하면 tropical 로 한다.',
].join('\n');

const SCHEMA_EXAMPLE = `{
  "scientific_name": "Monstera deliciosa",
  "name_ko": "몬스테라",
  "aliases_ko": ["몬스테라 델리시오사"],
  "group_code": "tropical",
  "base_interval": 7,
  "bonsai_group": null,
  "bonsai_tasks": [],
  "care": {
    "light": "밝은 간접광. 직사광은 잎이 탈 수 있어요.",
    "water": "겉흙 3cm가 마르면 화분 아래로 물이 나올 만큼.",
    "humidity": "50% 이상이면 좋아요. 겨울 난방철엔 분무.",
    "temp_min": 10,
    "temp_max": 32,
    "soil": "배수 좋은 배양토에 펄라이트 2할."
  },
  "fertilizer": {"months": [4,5,6,7,8,9,10], "interval_weeks": 4, "note": "액체비료 1000배 희석"},
  "repot_months": 18,
  "repot_season": [3,4,5],
  "toxic_pet": true,
  "winter_indoor_ok": true
}`;

export interface PromptOptions {
  /** 국명을 알고 있으면 넣는다. 유통명을 맞추는 데 쓴다 */
  nameKo?: string | null;
  /** 앞선 시도가 거부된 이유. 있으면 그것을 고쳐 다시 만든다 (10.4 재생성 1회) */
  rejectedReason?: string | null;
}

export function buildUserPrompt(scientificName: string, options: PromptOptions = {}): string {
  const parts = [
    `학명: ${scientificName}`,
    options.nameKo ? `국명(참고): ${options.nameKo}` : null,
    '',
    '식물군 매핑 규칙:',
    GROUP_RULES,
    '',
    'name_ko 는 한국 화원에서 실제로 부르는 이름을 쓴다. aliases_ko 에 다른 유통명을 넣는다.',
    'bonsai_tasks 는 분재일 때만 채운다. 각 항목은 {"task_code","month_start","month_end","label_ko"} 다.',
    '',
    '이 형식 그대로 답한다:',
    SCHEMA_EXAMPLE,
  ];

  if (options.rejectedReason) {
    parts.push(
      '',
      `앞서 만든 답이 이 이유로 거부되었다: ${options.rejectedReason}`,
      '그 부분을 고쳐서 다시 만든다.',
    );
  }

  return parts.filter((part) => part !== null).join('\n');
}
