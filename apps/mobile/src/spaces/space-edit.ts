/**
 * 등록한 공간을 고치는 규칙 (SPEC.md 3.3 공간 상세). 화면·DB 와 떼어 낸 순수 함수다.
 *
 * 빛 등급은 사람 > 사진 > 방향 × 유형 순서로 정해진다 (engine resolveLightGrade).
 * 사람이 고른 등급은 사진을 다시 찍어도 남는다. 스스로 고른 값을 말없이 되돌리지 않는다.
 */
import type { Space } from '../db/schema';
import { resolveLightGrade } from '../engine/light';
import type { LightGrade } from '../engine/types';

import { parseLightReading } from './light-reading';
import type { LightReading } from './light-reading';
import { MAX_SPACE_NAME_LENGTH } from './registration';

/** 저장해 둔 사진 판단. 없거나 깨졌으면 null */
export function spaceLightReading(space: Space): LightReading | null {
  return parseLightReading(space.aiEvidence);
}

/** 사람이 고르지 않았다면 정해질 등급 */
function automaticLight(space: Space, reading = spaceLightReading(space)) {
  return resolveLightGrade({
    direction: space.direction,
    spaceType: space.spaceType,
    ai: reading,
  });
}

/**
 * 빛 등급을 고쳤을 때 저장할 값. 가만히 두었을 때와 같은 등급을 고르면 고치지 않은 것으로 돌아간다.
 * 바꿀 것이 없으면 null 이다.
 */
export function planLightGrade(
  space: Space,
  lightGrade: LightGrade,
): Pick<Space, 'lightGrade' | 'lightSource'> | null {
  const automatic = automaticLight(space);
  const next =
    lightGrade === automatic.lightGrade
      ? automatic
      : { lightGrade, lightSource: 'manual' as const };

  return next.lightGrade === space.lightGrade && next.lightSource === space.lightSource
    ? null
    : next;
}

/**
 * 사진을 다시 찍었을 때 (3.3 재촬영). 새 사진으로 읽은 결과를 넣고 등급을 다시 정한다.
 * 사람이 고쳐 둔 등급은 그대로 둔다.
 */
export function planRetake(
  space: Space,
  photoPath: string,
  reading: LightReading | null,
): Pick<Space, 'photoPath' | 'lightGrade' | 'lightSource' | 'aiEvidence'> {
  const light =
    space.lightSource === 'manual'
      ? { lightGrade: space.lightGrade, lightSource: space.lightSource }
      : automaticLight(space, reading);

  return { photoPath, aiEvidence: reading, ...light };
}

/** 이름을 고쳤을 때 저장할 값. 비었거나 너무 길거나 그대로면 null */
export function planSpaceName(space: Space, name: string): Pick<Space, 'name'> | null {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_SPACE_NAME_LENGTH || trimmed === space.name) {
    return null;
  }
  return { name: trimmed };
}
