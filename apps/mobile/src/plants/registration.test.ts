import { describe, expect, it } from 'vitest';

import { DEFAULT_COEFFICIENTS } from '../engine';
import type { CalendarDate, EngineSpace } from '../engine';
import {
  canAdvance,
  createPlantDraft,
  MAX_DAYS_AGO,
  MAX_NICKNAME_LENGTH,
  MAX_PLANT_PHOTOS,
  parsePlantDraft,
  PLANT_STEPS,
  previewWatering,
  progressOf,
  reducePlantDraft,
  resolveBaseInterval,
  resolveGroupCode,
  resolveNickname,
  toNewPlant,
} from './registration';
import type { PlantDraft, PlantDraftAction } from './registration';
import { findSeedSpecies } from '../species/seed';

const C = DEFAULT_COEFFICIENTS;
const apply = (draft: PlantDraft, ...actions: PlantDraftAction[]) =>
  actions.reduce(reducePlantDraft, draft);
const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });
const photo = (name: string) => ({ path: `plants/${name}.jpg`, width: 960, height: 1280 });

const empty = createPlantDraft('plant-1');
/** 중광 실내 창가 */
const brightWindow: EngineSpace = { lightGrade: 'medium', spaceType: 'indoor_window' };

/** 시나리오 A 의 몬스테라: 중형, 배양토, 거실 창가 */
const monstera = apply(
  empty,
  { type: 'photoAdded', photo: photo('a') },
  { type: 'speciesChosen', species: seed('Monstera deliciosa') },
  { type: 'soilChosen', soilType: 'potting' },
  { type: 'spaceChosen', spaceId: 'space-1' },
);

/** 번들 시드에서 고른 종. 서버에서 받은 종과 같은 모양이다 */
function seed(scientificName: string) {
  const found = findSeedSpecies(scientificName);
  if (!found) throw new Error(`시드에 없는 학명: ${scientificName}`);
  return found;
}

describe('식물 등록 단계 (SPEC.md 4.2)', () => {
  it('사진 → 종 → 화분 → 흙 → 공간 → 분재 → 첫 알림 확인 순서다', () => {
    expect(PLANT_STEPS).toEqual(['photo', 'species', 'pot', 'soil', 'space', 'bonsai', 'finish']);
    expect(empty).toMatchObject({ step: 'photo', potSize: 'm', wateredDaysAgo: 0 });
  });

  it('화분은 기본값이 중형이라 바로 넘어가고, 나머지는 골라야 넘어간다', () => {
    const at = (step: PlantDraft['step'], draft = empty) => ({ ...draft, step });

    expect(canAdvance(at('photo'))).toBe(false);
    expect(canAdvance(at('species'))).toBe(false);
    expect(canAdvance(at('pot'))).toBe(true);
    expect(canAdvance(at('soil'))).toBe(false);
    expect(canAdvance(at('space'))).toBe(false);
    expect(canAdvance(at('bonsai'))).toBe(true);
    for (const step of PLANT_STEPS) expect(canAdvance(at(step, monstera))).toBe(true);
  });

  it('입력을 마쳐야 다음으로 가고, 언제든 뒤로 갈 수 있다', () => {
    expect(apply(empty, { type: 'next' }).step).toBe('photo');

    const moved = apply(monstera, { type: 'next' }, { type: 'next' }, { type: 'back' });
    expect(moved.step).toBe('species');
    expect(apply(empty, { type: 'back' }).step).toBe('photo');
  });

  it('진행률은 첫 단계 1/7 에서 마지막 1 까지 찬다', () => {
    expect(progressOf(empty)).toBeCloseTo(1 / 7, 10);
    expect(progressOf({ ...empty, step: 'finish' })).toBe(1);
  });

  it(`사진은 ${MAX_PLANT_PHOTOS}장까지이고 첫 장이 대표다`, () => {
    const full = apply(
      empty,
      { type: 'photoAdded', photo: photo('a') },
      { type: 'photoAdded', photo: photo('b') },
      { type: 'photoAdded', photo: photo('c') },
      { type: 'photoAdded', photo: photo('d') },
    );
    expect(full.photos.map((item) => item.path)).toEqual([
      'plants/a.jpg',
      'plants/b.jpg',
      'plants/c.jpg',
    ]);

    const removed = apply(full, { type: 'photoRemoved', path: 'plants/a.jpg' });
    expect(removed.photos.map((item) => item.path)).toEqual(['plants/b.jpg', 'plants/c.jpg']);
  });
});

describe('종 선택과 식물군 (SPEC 4.2, 10.2)', () => {
  it('시드 종을 고르면 식물군과 종별 기본 주기가 따라온다', () => {
    expect(resolveGroupCode(monstera)).toBe('tropical');
    expect(resolveBaseInterval(monstera)).toBe(7);
  });

  it('"모르겠어요"면 식물군을 직접 골라야 한다', () => {
    const unknown = apply({ ...empty, step: 'species' }, { type: 'speciesUnknown' });
    expect(canAdvance(unknown)).toBe(false);
    expect(resolveGroupCode(unknown)).toBeNull();

    const chosen = apply(unknown, { type: 'groupChosen', groupCode: 'succulent' });
    expect(canAdvance(chosen)).toBe(true);
    expect(resolveGroupCode(chosen)).toBe('succulent');
    expect(resolveBaseInterval(chosen)).toBeNull();
  });

  it('분재 수종을 고르면 분재 토글과 수종군이 자동으로 켜진다', () => {
    const pine = apply(empty, { type: 'speciesChosen', species: seed('Pinus thunbergii') });

    expect(pine).toMatchObject({ isBonsai: true, bonsaiGroup: 'conifer' });
    expect(resolveGroupCode(pine)).toBe('bonsai_conifer');
  });

  it('분재가 아닌 종으로 바꾸면 분재 설정이 풀린다', () => {
    const changed = apply(
      empty,
      { type: 'speciesChosen', species: seed('Pinus thunbergii') },
      { type: 'speciesChosen', species: seed('Monstera deliciosa') },
    );

    expect(changed).toMatchObject({ isBonsai: false, bonsaiGroup: null });
  });

  it('분재 토글을 켜면 수종군을 골라야 하고, 수종군이 식물군을 정한다', () => {
    const olive = apply(
      { ...empty, step: 'bonsai' },
      { type: 'speciesChosen', species: seed('Olea europaea') },
      { type: 'bonsaiToggled', isBonsai: true },
    );
    expect(canAdvance(olive)).toBe(false);

    const conifer = apply(olive, { type: 'bonsaiGroupChosen', bonsaiGroup: 'conifer' });
    const flowering = apply(olive, { type: 'bonsaiGroupChosen', bonsaiGroup: 'flowering' });
    expect(canAdvance(conifer)).toBe(true);
    expect(resolveGroupCode(conifer)).toBe('bonsai_conifer');
    expect(resolveGroupCode(flowering)).toBe('bonsai_deciduous');
    expect(resolveGroupCode(apply(olive, { type: 'bonsaiGroupChosen', bonsaiGroup: 'deciduous' }))).toBe(
      'bonsai_deciduous',
    );
  });

  it('분재 수종의 토글을 끄면 온대 수목으로 본다', () => {
    const gardenPine = apply(
      empty,
      { type: 'speciesChosen', species: seed('Pinus thunbergii') },
      { type: 'bonsaiToggled', isBonsai: false },
    );

    expect(gardenPine.bonsaiGroup).toBeNull();
    expect(resolveGroupCode(gardenPine)).toBe('temperate');
  });

  it('토글을 다시 켜면 종의 수종군이 돌아온다', () => {
    const pine = apply(
      empty,
      { type: 'speciesChosen', species: seed('Pinus thunbergii') },
      { type: 'bonsaiToggled', isBonsai: false },
      { type: 'bonsaiToggled', isBonsai: true },
    );

    expect(pine.bonsaiGroup).toBe('conifer');
  });

  it('일반 종을 분재로 키우면 종별 주기 대신 분재군 기본값을 쓴다 (얕은 분은 훨씬 빨리 마른다)', () => {
    const bonsaiZz = apply(
      empty,
      { type: 'speciesChosen', species: seed('Zamioculcas zamiifolia') },
      { type: 'bonsaiToggled', isBonsai: true },
      { type: 'bonsaiGroupChosen', bonsaiGroup: 'deciduous' },
    );

    expect(resolveBaseInterval(bonsaiZz)).toBeNull();
    expect(resolveBaseInterval(apply(bonsaiZz, { type: 'bonsaiToggled', isBonsai: false }))).toBe(14);
  });

  it('분재 수종에 정원수 기준 긴 주기가 붙어 오면 쓰지 않는다 (예전 서버 값이 기기에 남은 경우)', () => {
    // 2026-09-24 이전 서버는 분재 수종에도 4~10일을 줬다. 분재 화분 기준은 3일 안쪽이다
    const juniper = (baseInterval: number | null) =>
      apply(empty, {
        type: 'speciesChosen',
        species: {
          scientificName: 'Juniperus chinensis',
          nameKo: '향나무',
          groupCode: 'bonsai_conifer',
          baseInterval,
          bonsaiGroup: 'conifer',
        },
      });

    expect(resolveBaseInterval(juniper(7))).toBeNull();
    expect(resolveBaseInterval(juniper(3))).toBe(3);
    expect(resolveBaseInterval(juniper(null))).toBeNull();
  });
});

describe('별명', () => {
  it('기본값은 국명이고, 같은 별명이 있으면 번호를 붙인다', () => {
    expect(resolveNickname(monstera, [])).toBe('몬스테라');
    expect(resolveNickname(monstera, ['몬스테라'])).toBe('몬스테라 2');
  });

  it('종을 모르면 식물군 이름을 쓴다', () => {
    const unknown = apply(
      empty,
      { type: 'speciesUnknown' },
      { type: 'groupChosen', groupCode: 'succulent' },
    );

    expect(resolveNickname(unknown, [])).toBe('다육·선인장');
  });

  it('고친 별명을 쓰고, 비었거나 너무 길면 저장할 수 없다', () => {
    const atFinish = { ...monstera, step: 'finish' as const };
    const named = (nickname: string) => apply(atFinish, { type: 'nicknameEdited', nickname });

    expect(resolveNickname(named(' 거실 몬스테라 '), [])).toBe('거실 몬스테라');
    expect(canAdvance(named('  '))).toBe(false);
    expect(canAdvance(named('가'.repeat(MAX_NICKNAME_LENGTH)))).toBe(true);
    expect(canAdvance(named('가'.repeat(MAX_NICKNAME_LENGTH + 1)))).toBe(false);
  });
});

describe('첫 물주기 확인 (SPEC 4.2 완료, 5.5)', () => {
  const today = date(2026, 9, 20);

  it('시나리오 A: 오늘 물을 준 몬스테라는 7일 뒤 9월 27일', () => {
    const preview = previewWatering(monstera, brightWindow, { today, season: 'autumn' }, C);

    expect(preview).toMatchObject({
      days: 7,
      lastWatered: date(2026, 9, 20),
      nextWater: date(2026, 9, 27),
      daysLeft: 7,
    });
    expect(preview?.result).toMatchObject({ mode: 'computed', days: 7 });
  });

  it('며칠 전에 줬으면 그날부터 센다', () => {
    const watered = apply(monstera, { type: 'wateredDaysAgoChanged', days: 3 });
    const preview = previewWatering(watered, brightWindow, { today, season: 'autumn' }, C);

    expect(preview).toMatchObject({
      lastWatered: date(2026, 9, 17),
      nextWater: date(2026, 9, 24),
      daysLeft: 4,
    });
  });

  it('주기보다 오래전에 줬으면 등록하자마자 밀림이다', () => {
    const watered = apply(monstera, { type: 'wateredDaysAgoChanged', days: 10 });
    const preview = previewWatering(watered, brightWindow, { today, season: 'autumn' }, C);

    expect(preview).toMatchObject({ nextWater: date(2026, 9, 17), daysLeft: -3 });
  });

  it(`물 준 날은 오늘부터 ${MAX_DAYS_AGO}일 전까지만 받는다`, () => {
    expect(apply(monstera, { type: 'wateredDaysAgoChanged', days: -2 }).wateredDaysAgo).toBe(0);
    expect(apply(monstera, { type: 'wateredDaysAgoChanged', days: 999 }).wateredDaysAgo).toBe(
      MAX_DAYS_AGO,
    );
  });

  it('마지막 물 준 날을 모르면 오늘로 두고 첫 알림은 I/2일 뒤다', () => {
    const unknown = apply(
      monstera,
      { type: 'wateredDaysAgoChanged', days: 5 },
      { type: 'wateredUnknownToggled', unknown: true },
    );
    const preview = previewWatering(unknown, brightWindow, { today, season: 'autumn' }, C);

    // 7일 주기의 절반 3.5 → 4일
    expect(preview).toMatchObject({ days: 4, lastWatered: today, nextWater: date(2026, 9, 24) });
  });

  it('날짜를 다시 고르면 "모름"이 풀린다', () => {
    const changed = apply(
      monstera,
      { type: 'wateredUnknownToggled', unknown: true },
      { type: 'wateredDaysAgoChanged', days: 1 },
    );

    expect(changed).toMatchObject({ wateredUnknown: false, wateredDaysAgo: 1 });
  });

  it('수경은 계수 없이 7일마다 물을 간다', () => {
    const hydro = apply(monstera, { type: 'soilChosen', soilType: 'hydro' });
    const preview = previewWatering(hydro, brightWindow, { today, season: 'winter' }, C);

    expect(preview?.result).toMatchObject({ mode: 'hydro', days: 7 });
    expect(preview?.nextWater).toEqual(date(2026, 9, 27));
  });

  it('분재로 켜면 분재군 계수로 계산한다: 흑송, 폭염, 테라스, 적옥토 → 1일', () => {
    const pine = apply(
      monstera,
      { type: 'speciesChosen', species: seed('Pinus thunbergii') },
      { type: 'soilChosen', soilType: 'akadama' },
    );
    const terrace: EngineSpace = { lightGrade: 'high', spaceType: 'terrace' };
    const preview = previewWatering(pine, terrace, { today: date(2026, 8, 1), season: 'heat' }, C);

    expect(preview?.result).toMatchObject({ mode: 'computed', days: 1, belowMin: true });
    expect(preview?.nextWater).toEqual(date(2026, 8, 2));
  });

  it('입력이 덜 됐으면 계산하지 않는다', () => {
    expect(previewWatering(empty, brightWindow, { today, season: 'autumn' }, C)).toBeNull();
  });
});

describe('저장할 식물 만들기', () => {
  // 2026-09-20 15:30 KST
  const now = Date.UTC(2026, 8, 20, 6, 30);
  const context = {
    space: brightWindow,
    existingNicknames: [] as string[],
    now,
    utcOffsetMinutes: 540,
    season: 'autumn' as const,
    coefficients: C,
  };

  it('초안을 plants 행과 photos 행으로 바꾼다', () => {
    const draft = apply(monstera, { type: 'photoAdded', photo: photo('b') });
    const created = toNewPlant(draft, context);

    expect(created?.plant).toEqual({
      id: 'plant-1',
      spaceId: 'space-1',
      scientificName: 'Monstera deliciosa',
      nickname: '몬스테라',
      groupCode: 'tropical',
      potSize: 'm',
      soilType: 'potting',
      isBonsai: false,
      bonsaiGroup: null,
      learnFactor: 1.0,
      // 고른 종의 기본 주기를 그대로 저장한다. 오프라인에서도 같은 값으로 센다
      baseInterval: 7,
      // 물 준 날의 정오, 다음 물주기 날의 0시 (둘 다 기기 시간대)
      lastWateredAt: Date.UTC(2026, 8, 20, 3, 0),
      lastWateredUnknown: false,
      nextWaterAt: Date.UTC(2026, 8, 26, 15, 0),
      coverPhotoPath: 'plants/a.jpg',
      createdAt: now,
    });
    expect(created?.photos).toEqual([
      { id: 'plant-1-photo-1', plantId: 'plant-1', path: 'plants/a.jpg', takenAt: now, width: 960, height: 1280 },
      { id: 'plant-1-photo-2', plantId: 'plant-1', path: 'plants/b.jpg', takenAt: now, width: 960, height: 1280 },
    ]);
  });

  it('"모름"이면 표시를 남기고 첫 알림을 I/2일 뒤로 잡는다', () => {
    const unknown = apply(monstera, { type: 'wateredUnknownToggled', unknown: true });
    const created = toNewPlant(unknown, context);

    expect(created?.plant).toMatchObject({
      lastWateredUnknown: true,
      lastWateredAt: Date.UTC(2026, 8, 20, 3, 0),
      nextWaterAt: Date.UTC(2026, 8, 23, 15, 0),
    });
  });

  it('종을 모르면 학명 없이 식물군만 저장한다', () => {
    const unknownSpecies = apply(
      monstera,
      { type: 'speciesUnknown' },
      { type: 'groupChosen', groupCode: 'herb' },
    );

    expect(toNewPlant(unknownSpecies, context)?.plant).toMatchObject({
      scientificName: null,
      groupCode: 'herb',
      nickname: '허브·초화·채소',
    });
  });

  it('분재는 수종군과 분재 식물군을 저장한다', () => {
    const pine = apply(
      monstera,
      { type: 'speciesChosen', species: seed('Pinus thunbergii') },
      { type: 'soilChosen', soilType: 'akadama' },
    );

    expect(toNewPlant(pine, context)?.plant).toMatchObject({
      isBonsai: true,
      bonsaiGroup: 'conifer',
      groupCode: 'bonsai_conifer',
      nickname: '곰솔',
    });
  });

  it('입력이 덜 됐으면 만들지 않는다', () => {
    expect(toNewPlant(empty, context)).toBeNull();
    expect(toNewPlant(apply(monstera, { type: 'nicknameEdited', nickname: ' ' }), context)).toBeNull();
  });
});

describe('임시 저장 복원 (SPEC 4)', () => {
  it('저장한 초안을 그대로 되살린다', () => {
    const draft = apply(
      monstera,
      { type: 'next' },
      { type: 'wateredDaysAgoChanged', days: 2 },
      { type: 'nicknameEdited', nickname: '거실 몬스테라' },
    );

    expect(parsePlantDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it('"모르겠어요" 초안도 되살린다', () => {
    const draft = apply(empty, { type: 'speciesUnknown' }, { type: 'groupChosen', groupCode: 'herb' });

    expect(parsePlantDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it('없거나 깨진 값은 버린다', () => {
    const broken = (patch: Record<string, unknown>) =>
      parsePlantDraft(JSON.stringify({ ...monstera, ...patch }));

    expect(parsePlantDraft(null)).toBeNull();
    expect(parsePlantDraft('{not json')).toBeNull();
    expect(parsePlantDraft('[]')).toBeNull();
    expect(broken({ id: '' })).toBeNull();
    expect(broken({ step: 'checkout' })).toBeNull();
    expect(broken({ photos: 'a.jpg' })).toBeNull();
    expect(broken({ photos: [{ path: 1, width: 1, height: 1 }] })).toBeNull();
    expect(broken({ species: { kind: 'known', species: { scientificName: '' } } })).toBeNull();
    expect(
      broken({ species: { kind: 'known', species: { ...seed('Monstera deliciosa'), groupCode: 'x' } } }),
    ).toBeNull();
    expect(broken({ species: { kind: 'unknown', groupCode: 'bonsai_conifer' } })).toBeNull();
    expect(broken({ potSize: 'xxl' })).toBeNull();
    expect(broken({ soilType: 'sand' })).toBeNull();
    expect(broken({ spaceId: 3 })).toBeNull();
    expect(broken({ isBonsai: 'yes' })).toBeNull();
    expect(broken({ bonsaiGroup: 'tropical' })).toBeNull();
    expect(broken({ nickname: 3 })).toBeNull();
    expect(broken({ wateredDaysAgo: -1 })).toBeNull();
    expect(broken({ wateredDaysAgo: 1.5 })).toBeNull();
    expect(broken({ wateredUnknown: 'no' })).toBeNull();
  });

  it('입력보다 앞선 단계가 저장돼 있으면 아직 안 채운 첫 단계로 되돌린다', () => {
    const ahead = { ...monstera, soilType: null, step: 'finish' };

    expect(parsePlantDraft(JSON.stringify(ahead))?.step).toBe('soil');
  });
});
