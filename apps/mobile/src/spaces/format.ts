/**
 * 공간을 글로 (SPEC.md 3.3). 방향과 유형을 한 줄로 묶고, 카드를 한 번에 읽을 말을 만든다.
 */
import type { Space } from '../db/schema';
import { ko } from '../i18n/ko';

/** "남향 실내 창가". 방향을 모르면 유형만 */
export function formatPlace(space: Pick<Space, 'direction' | 'spaceType'>): string {
  const type = ko.spaceType[space.spaceType];
  return space.direction === 'unknown' ? type : `${ko.directionName[space.direction]} ${type}`;
}

/** 공간 카드 한 줄: 자리와, 식물 수를 받았으면 그 수까지 */
export function formatSpaceLine(
  space: Pick<Space, 'direction' | 'spaceType'>,
  plantCount?: number,
): string {
  const place = formatPlace(space);
  return plantCount === undefined ? place : `${place}, ${ko.spacesTab.plantCount(plantCount)}`;
}

/**
 * 공간 카드를 한 번에 읽을 말: "거실 창가, 남향 실내 창가, 식물 2개, 밝아요".
 * 카드를 누를 수 있으면 스크린리더가 카드 안의 글자 대신 이 말만 읽는다 (SPEC 15).
 */
export function spaceCardLabel(
  space: Pick<Space, 'name' | 'direction' | 'spaceType' | 'lightGrade'>,
  plantCount?: number,
): string {
  return [space.name, formatSpaceLine(space, plantCount), ko.lightGrade[space.lightGrade]].join(', ');
}
