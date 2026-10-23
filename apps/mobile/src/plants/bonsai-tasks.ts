/**
 * 분재 작업 캘린더의 기준표 (SPEC.md 6.2). 서버의 종 정보는 AI 가 만들어 사람이 검수한 것이 적으므로,
 * 작업은 수종군(과 소나무류인지)으로 정해진 이 표를 쓴다 (10-1). 비료는 feeding.ts 가 따로 센다.
 * 화면·DB 와 무관한 순수 데이터다.
 */
import type { BonsaiGroup } from '../db/schema';
import { ko } from '../i18n/ko';

export type BonsaiTaskCode = keyof typeof ko.plantDetail.taskLabel;

export interface BonsaiTaskSpec {
  taskCode: BonsaiTaskCode;
  monthStart: number;
  monthEnd: number;
  labelKo: string;
}

const task = (taskCode: BonsaiTaskCode, monthStart: number, monthEnd: number): BonsaiTaskSpec => ({
  taskCode,
  monthStart,
  monthEnd,
  labelKo: ko.plantDetail.taskLabel[taskCode],
});

/** 소나무·곰솔·섬잣나무처럼 순을 꺾고 묵은 잎을 뽑는 소나무류 */
const PINE_GENERA = ['Pinus'];

const PINE: BonsaiTaskSpec[] = [
  task('pinch_candles', 5, 6),
  task('pull_old_needles', 10, 11),
  task('wiring', 11, 2),
  task('repot', 3, 3),
];

/** 향나무·진백·주목처럼 웃자란 순을 집어 주는 침엽 */
const CONIFER: BonsaiTaskSpec[] = [
  task('pinch_tips', 4, 9),
  task('repot', 3, 4),
];

/** 단풍·느티·소사 같은 잡목 */
const DECIDUOUS: BonsaiTaskSpec[] = [
  task('repot', 2, 3),
  task('defoliate', 6, 6),
  task('prune', 11, 12),
];

/** 명자·철쭉·모과 같은 화목·실물. 꽃눈이 생기기 전에 정리한다 */
const FLOWERING: BonsaiTaskSpec[] = [
  task('prune_after_bloom', 4, 6),
  task('repot', 3, 3),
];

const genusOf = (scientificName: string | null | undefined): string =>
  (scientificName ?? '').trim().split(/\s+/)[0] ?? '';

/** 수종군과 학명으로 고른 작업표. 종을 모르는 침엽은 순집기 쪽으로 본다 */
export function bonsaiTasksFor(
  bonsaiGroup: BonsaiGroup | null | undefined,
  scientificName?: string | null,
): BonsaiTaskSpec[] {
  switch (bonsaiGroup) {
    case 'conifer':
      return PINE_GENERA.includes(genusOf(scientificName)) ? PINE : CONIFER;
    case 'deciduous':
      return DECIDUOUS;
    case 'flowering':
      return FLOWERING;
    default:
      return [];
  }
}
