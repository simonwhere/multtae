import { describe, expect, it } from 'vitest';

import type { Plant, Space } from '../db/schema';
import { winterWarnings } from './winter';

const space = (patch: Partial<Space>): Space => ({
  id: 'space-1',
  name: '남향 거실 창가',
  photoPath: null,
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  aiEvidence: null,
  createdAt: 1,
  ...patch,
});

const plant = (patch: Partial<Plant>): Plant =>
  ({
    id: 'plant-1',
    spaceId: 'space-1',
    nickname: '단풍',
    groupCode: 'bonsai_deciduous',
    isBonsai: true,
    bonsaiGroup: 'deciduous',
    ...patch,
  }) as Plant;

const item = (p: Partial<Plant>, s: Partial<Space> = {}) => ({ plant: plant(p), space: space(s) });

describe('winterWarnings: 분재 월동 (SPEC.md 6.3)', () => {
  it('잡목 분재가 실내에 있으면 옮기라고 알린다', () => {
    const warnings = winterWarnings([item({})], 'winter');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: 'deciduous_indoor', nicknames: ['단풍'] });
  });

  it('창에서 먼 실내도 같다', () => {
    const warnings = winterWarnings([item({}, { spaceType: 'indoor_far' })], 'winter');

    expect(warnings[0]?.kind).toBe('deciduous_indoor');
  });

  it('침엽 분재가 실내면 실외 월동을 권한다', () => {
    const warnings = winterWarnings(
      [item({ nickname: '곰솔', groupCode: 'bonsai_conifer', bonsaiGroup: 'conifer' })],
      'winter',
    );

    expect(warnings[0]).toMatchObject({ kind: 'conifer_indoor', nicknames: ['곰솔'] });
  });

  it('발코니 확장이나 테라스에 있으면 알리지 않는다', () => {
    expect(winterWarnings([item({}, { spaceType: 'balcony_ext' })], 'winter')).toEqual([]);
    expect(winterWarnings([item({}, { spaceType: 'terrace' })], 'winter')).toEqual([]);
  });

  it('겨울이 아니면 알리지 않는다', () => {
    expect(winterWarnings([item({})], 'autumn')).toEqual([]);
  });

  it('분재가 아니면 알리지 않는다. 열대 관엽은 실내가 맞다', () => {
    const monstera = item({ nickname: '몬스테라', groupCode: 'tropical', isBonsai: false, bonsaiGroup: null });

    expect(winterWarnings([monstera], 'winter')).toEqual([]);
  });

  it('같은 경고의 식물은 하나로 묶는다', () => {
    const warnings = winterWarnings(
      [item({}), item({ id: 'plant-2', nickname: '느티' })],
      'winter',
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.nicknames).toEqual(['단풍', '느티']);
  });

  it('화목도 잡목과 같이 본다', () => {
    const warnings = winterWarnings([item({ nickname: '명자', bonsaiGroup: 'flowering' })], 'winter');

    expect(warnings[0]?.kind).toBe('deciduous_indoor');
  });
});
