/**
 * 공간 상세의 계절 메모 (SPEC.md 3.3). 지금 계절에 이 자리에서 알아 둘 점을 한 줄로 말한다.
 * 날씨를 부르지 않고 유형과 계절만 보는 고정 문구다. 날씨로 바뀌는 경고 카드는 5주차다 (7.2).
 *
 * 겨울 실내의 온풍 문구는 7.3, 장마의 통풍 문구는 7.4, 발코니 새벽 기온은 3.3 의 예시에서 왔다.
 */
import type { Season, SpaceType } from '../engine/types';
import { ko } from '../i18n/ko';

/** 할 말이 없는 계절은 비워 둔다. 없는 말을 지어내지 않는다 */
const MEMO: Record<SpaceType, Partial<Record<Season, keyof typeof ko.spaceDetail.memo>>> = {
  indoor_window: {
    monsoon: 'indoorMonsoon',
    heat: 'windowHeat',
    winter: 'indoorWinter',
  },
  indoor_far: {
    monsoon: 'indoorMonsoon',
    winter: 'indoorWinter',
  },
  balcony_ext: {
    monsoon: 'outdoorMonsoon',
    heat: 'outdoorHeat',
    winter: 'balconyWinter',
  },
  terrace: {
    spring: 'terraceSpring',
    monsoon: 'outdoorMonsoon',
    heat: 'outdoorHeat',
    autumn: 'terraceAutumn',
    winter: 'terraceWinter',
  },
};

export function seasonMemo(spaceType: SpaceType, season: Season): string | null {
  const key = MEMO[spaceType][season];
  return key ? ko.spaceDetail.memo[key] : null;
}
