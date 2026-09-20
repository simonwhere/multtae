import { describe, expect, it } from 'vitest';

import { GROUP_CODES } from '../engine/types';
import { findSeedSpecies, searchSpecies, SEED_SPECIES } from './seed';

const names = (query: string) => searchSpecies(query).map((species) => species.nameKo);

describe('번들 시드 30종 (SPEC.md 16장 2-2)', () => {
  it('30종이고 학명이 겹치지 않는다', () => {
    expect(SEED_SPECIES).toHaveLength(30);
    expect(new Set(SEED_SPECIES.map((species) => species.scientificName)).size).toBe(30);
    expect(new Set(SEED_SPECIES.map((species) => species.nameKo)).size).toBe(30);
  });

  it('식물군 비율은 10.5 의 구성을 따른다: 관엽 11, 다육 6, 온대 5, 허브 4, 분재 4', () => {
    const count = (group: string) =>
      SEED_SPECIES.filter((species) => species.groupCode === group).length;

    expect(count('tropical')).toBe(11);
    expect(count('succulent')).toBe(6);
    expect(count('temperate')).toBe(5);
    expect(count('herb')).toBe(4);
    expect(count('bonsai_conifer') + count('bonsai_deciduous')).toBe(4);
  });

  it('모든 종이 10.4 의 검증 규칙을 지킨다', () => {
    for (const species of SEED_SPECIES) {
      expect(GROUP_CODES).toContain(species.groupCode);
      expect(species.nameKo.trim()).not.toBe('');
      expect(species.scientificName).toMatch(/^[A-Z][a-z]+ /);
      expect(species.aliasesKo).not.toContain(species.nameKo);
      if (species.baseInterval !== null) {
        expect(species.baseInterval).toBeGreaterThanOrEqual(0.5);
        expect(species.baseInterval).toBeLessThanOrEqual(30);
      }
    }
  });

  it('분재 수종만 수종군을 갖고, 식물군과 어긋나지 않는다', () => {
    for (const species of SEED_SPECIES) {
      const isBonsaiGroup = species.groupCode.startsWith('bonsai_');
      expect(species.bonsaiGroup !== null).toBe(isBonsaiGroup);
      if (species.bonsaiGroup === 'conifer') expect(species.groupCode).toBe('bonsai_conifer');
      if (species.bonsaiGroup === 'deciduous' || species.bonsaiGroup === 'flowering') {
        expect(species.groupCode).toBe('bonsai_deciduous');
      }
    }
  });

  it('SPEC 예시의 종은 표의 기본 주기와 맞는다', () => {
    expect(findSeedSpecies('Monstera deliciosa')).toMatchObject({
      nameKo: '몬스테라',
      groupCode: 'tropical',
      baseInterval: 7,
    });
    expect(findSeedSpecies('Pinus thunbergii')?.groupCode).toBe('bonsai_conifer');
    expect(findSeedSpecies('Ocimum basilicum')?.groupCode).toBe('herb');
  });

  it('식물군 기본값과 크게 다른 잘 알려진 종만 개별 주기를 갖는다', () => {
    expect(findSeedSpecies('Dracaena trifasciata')?.baseInterval).toBe(21);
    expect(findSeedSpecies('Zamioculcas zamiifolia')?.baseInterval).toBe(14);
    expect(findSeedSpecies('Spathiphyllum wallisii')?.baseInterval).toBe(5);
    expect(findSeedSpecies('Epipremnum aureum')?.baseInterval).toBeNull();
  });

  it('없는 학명은 undefined 다', () => {
    expect(findSeedSpecies('Nonexistent plantus')).toBeUndefined();
  });
});

describe('searchSpecies: 텍스트 검색', () => {
  it('국명의 일부로 찾는다', () => {
    expect(names('몬스')).toEqual(['몬스테라']);
  });

  it('앞에서부터 맞는 이름이 먼저 온다', () => {
    const results = names('고무');

    expect(results).toEqual(expect.arrayContaining(['인도고무나무', '벤자민고무나무']));
    expect(names('벤자민')[0]).toBe('벤자민고무나무');
  });

  it('별칭으로 찾는다', () => {
    expect(names('스투키')).toEqual(['스투키']);
    expect(names('돈나무')).toEqual(['금전수']);
    expect(names('흑송')).toEqual(['곰솔']);
  });

  it('학명은 대소문자를 가리지 않고, 옛 학명으로도 찾는다', () => {
    expect(names('monstera')).toEqual(['몬스테라']);
    expect(names('SANSEVIERIA')).toEqual(expect.arrayContaining(['산세베리아', '스투키']));
  });

  it('띄어쓰기와 앞뒤 공백은 무시한다', () => {
    expect(names('  스킨 답서스 ')).toEqual(['스킨답서스']);
  });

  it('검색어가 없으면 전부를 가나다순으로 준다', () => {
    const all = names('');

    expect(all).toHaveLength(30);
    expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b, 'ko')));
  });

  it('맞는 종이 없으면 빈 배열이다', () => {
    expect(names('바오밥')).toEqual([]);
  });
});
