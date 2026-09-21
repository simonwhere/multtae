import { describe, expect, it } from 'vitest';

import { extractJson, GENERATED_SPECIES, validateSpecies } from './species-schema';

const monstera = () => ({
  scientific_name: 'Monstera deliciosa',
  name_ko: '몬스테라',
  aliases_ko: ['몬스테라 델리시오사'],
  group_code: 'tropical',
  base_interval: 7,
  bonsai_group: null,
  bonsai_tasks: [],
  care: {
    light: '밝은 간접광. 직사광은 잎이 탈 수 있어요.',
    water: '겉흙 3cm가 마르면 화분 아래로 물이 나올 만큼.',
    humidity: '50% 이상이면 좋아요. 겨울 난방철엔 분무.',
    temp_min: 10,
    temp_max: 32,
    soil: '배수 좋은 배양토에 펄라이트 2할.',
  },
  fertilizer: { months: [4, 5, 6, 7, 8, 9, 10], interval_weeks: 4, note: '액체비료 1000배 희석' },
  repot_months: 18,
  repot_season: [3, 4, 5],
  toxic_pet: true,
  winter_indoor_ok: true,
});

const reject = (patch: Record<string, unknown>) =>
  validateSpecies({ ...monstera(), ...patch }).ok;

describe('validateSpecies: 스키마 (SPEC.md 10.4)', () => {
  it('SPEC 10.3 의 예시를 통과시킨다', () => {
    const result = validateSpecies(monstera());

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.scientific_name).toBe('Monstera deliciosa');
  });

  it('식물군은 여섯 개 중 하나다', () => {
    expect(reject({ group_code: 'succulent', base_interval: 14, winter_indoor_ok: true })).toBe(true);
    expect(reject({ group_code: 'flower' })).toBe(false);
    expect(reject({ group_code: null })).toBe(false);
  });

  it('기본 주기는 0.5~30일이다', () => {
    expect(reject({ base_interval: 0.5 })).toBe(true);
    expect(reject({ base_interval: 30 })).toBe(true);
    expect(reject({ base_interval: 0.4 })).toBe(false);
    expect(reject({ base_interval: 31 })).toBe(false);
    expect(reject({ base_interval: null })).toBe(true);
  });

  it('최저 온도는 최고 온도보다 낮아야 한다', () => {
    expect(reject({ care: { ...monstera().care, temp_min: 30, temp_max: 20 } })).toBe(false);
    expect(reject({ care: { ...monstera().care, temp_min: 20, temp_max: 20 } })).toBe(false);
  });

  it('관리 문구는 비어 있으면 안 되고 너무 길어도 안 된다 (두 문장 이내)', () => {
    expect(reject({ care: { ...monstera().care, light: '' } })).toBe(false);
    expect(reject({ care: { ...monstera().care, light: '가'.repeat(201) } })).toBe(false);
  });

  it('없는 항목은 null 로 받는다', () => {
    const sparse = validateSpecies({
      ...monstera(),
      fertilizer: null,
      repot_months: null,
      toxic_pet: null,
    });

    expect(sparse.ok).toBe(true);
  });

  it('월은 1~12 다', () => {
    expect(reject({ repot_season: [3, 13] })).toBe(false);
    expect(reject({ fertilizer: { months: [0], interval_weeks: 4, note: null } })).toBe(false);
  });
});

describe('validateSpecies: 상식 체크 (SPEC.md 10.4)', () => {
  it('다육인데 주기가 7일 미만이면 거부한다', () => {
    expect(reject({ group_code: 'succulent', base_interval: 6 })).toBe(false);
    expect(reject({ group_code: 'succulent', base_interval: 14 })).toBe(true);
  });

  it('열대인데 실내 월동이 안 된다고 하면 거부한다', () => {
    expect(reject({ winter_indoor_ok: false })).toBe(false);
  });

  it('수종군과 식물군이 어긋나면 거부한다', () => {
    expect(reject({ bonsai_group: 'conifer' })).toBe(false);
    expect(reject({ group_code: 'bonsai_conifer', base_interval: 2, bonsai_group: null })).toBe(false);
    expect(
      reject({ group_code: 'bonsai_conifer', base_interval: 2, bonsai_group: 'conifer' }),
    ).toBe(true);
  });

  it('열대인데 최저 온도가 영하면 거부한다', () => {
    expect(reject({ care: { ...monstera().care, temp_min: -5 } })).toBe(false);
  });

  it('거부할 때 이유를 남긴다. 재생성 프롬프트에 넣는다', () => {
    const result = validateSpecies({ ...monstera(), group_code: 'succulent', base_interval: 3 });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('succulent');
  });
});

describe('extractJson: Claude 응답에서 JSON 만 꺼낸다', () => {
  it('그대로 JSON 이면 그대로 읽는다', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('코드 블록으로 감싸도 읽는다', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('앞뒤에 설명이 붙어도 읽는다', () => {
    expect(extractJson('네, 알려드릴게요.\n{"a":1}\n도움이 되었길 바라요.')).toEqual({ a: 1 });
  });

  it('JSON 이 없으면 null 이다', () => {
    expect(extractJson('모르겠어요')).toBeNull();
    expect(extractJson('{깨짐')).toBeNull();
    expect(extractJson('')).toBeNull();
  });
});

describe('GENERATED_SPECIES: DB 에 넣는 모양 (SPEC.md 10.4)', () => {
  it('생성본은 source=generated, reviewed=false 다', () => {
    const result = validateSpecies(monstera());
    if (!result.ok) throw new Error(result.reason);

    expect(GENERATED_SPECIES(result.value)).toMatchObject({
      source: 'generated',
      reviewed: false,
      name_ko: '몬스테라',
      group_code: 'tropical',
    });
  });
});
