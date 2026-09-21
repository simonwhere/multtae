import { describe, expect, it } from 'vitest';

import { toKnownSpecies } from './species';

const row = (patch: Record<string, unknown> = {}) => ({
  scientific_name: 'Monstera deliciosa',
  name_ko: '몬스테라',
  aliases_ko: ['몬스테라 델리시오사'],
  group_code: 'tropical',
  base_interval: 7,
  bonsai_group: null,
  care: { light: '밝은 간접광.', water: '겉흙이 마르면.', humidity: '50% 이상.', soil: '배양토.' },
  ...patch,
});

describe('toKnownSpecies: 서버 행을 앱이 쓰는 종으로 (SPEC.md 3-5)', () => {
  it('snake_case 를 camelCase 로 바꾼다', () => {
    expect(toKnownSpecies(row())).toEqual({
      scientificName: 'Monstera deliciosa',
      nameKo: '몬스테라',
      groupCode: 'tropical',
      baseInterval: 7,
      bonsaiGroup: null,
    });
  });

  it('분재 수종은 수종군을 가져온다', () => {
    expect(toKnownSpecies(row({ group_code: 'bonsai_conifer', bonsai_group: 'conifer' }))).toMatchObject({
      groupCode: 'bonsai_conifer',
      bonsaiGroup: 'conifer',
    });
  });

  it('국명이 없으면 학명을 쓴다. 빈 이름을 보여 주지 않는다', () => {
    expect(toKnownSpecies(row({ name_ko: null }))?.nameKo).toBe('Monstera deliciosa');
  });

  it('모르는 식물군이거나 모양이 다르면 null. 서버 응답을 믿지 않는다', () => {
    expect(toKnownSpecies(row({ group_code: 'flower' }))).toBeNull();
    expect(toKnownSpecies(row({ scientific_name: '' }))).toBeNull();
    expect(toKnownSpecies(null)).toBeNull();
    expect(toKnownSpecies({})).toBeNull();
  });

  it('주기가 숫자가 아니면 null 로 둔다. 엔진이 식물군 기본값을 쓴다', () => {
    expect(toKnownSpecies(row({ base_interval: '7일' }))?.baseInterval).toBeNull();
    expect(toKnownSpecies(row({ base_interval: null }))?.baseInterval).toBeNull();
  });
});
