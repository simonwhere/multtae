/**
 * 분재 월동 경고 (SPEC.md 6.3). 겨울에 분재가 실내에 있으면 오늘 탭에 알린다.
 * 한파·서리 경고는 날씨를 받아야 해서 5주차에 붙인다. 화면·DB 와 무관한 순수 함수다.
 */
import type { PlantWithSpace } from '../db/plants';
import type { Season } from '../engine';

export type WinterWarningKind = 'deciduous_indoor' | 'conifer_indoor';

export interface WinterWarning {
  kind: WinterWarningKind;
  nicknames: string[];
}

/** 실내로 보는 자리. 발코니 확장과 테라스는 바깥 공기를 받아 월동이 된다 */
const INDOOR = new Set(['indoor_window', 'indoor_far']);

export function winterWarnings(
  items: readonly PlantWithSpace[],
  season: Season,
): WinterWarning[] {
  if (season !== 'winter') return [];

  const byKind = new Map<WinterWarningKind, string[]>();
  for (const { plant, space } of items) {
    if (!plant.isBonsai || !INDOOR.has(space.spaceType)) continue;

    // 잡목과 화목은 실내에서 휴면을 못 해 약해지고, 침엽은 실외 월동이 원칙이다
    const kind: WinterWarningKind =
      plant.bonsaiGroup === 'conifer' ? 'conifer_indoor' : 'deciduous_indoor';
    byKind.set(kind, [...(byKind.get(kind) ?? []), plant.nickname]);
  }

  return [...byKind.entries()].map(([kind, nicknames]) => ({ kind, nicknames }));
}
