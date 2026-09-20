/**
 * 흙 게이지에 그리는 선의 SVG path (SPEC.md 14.1). 폭에 맞춰 만들기 때문에 어느 크기에서도 밀도가 같다.
 * 난수를 쓰지 않아 같은 입력이면 늘 같은 모양이고, 렌더링과 무관한 순수 함수라 Node 에서 테스트한다.
 */

/** fine: 물 줄 날의 잔금, deep: 밀린 흙의 균열 */
export type CrackKind = 'fine' | 'deep';

const CRACK_SPACING: Record<CrackKind, number> = { fine: 26, deep: 40 };
const POT_INSET_RATIO = 0.08;
const POT_MAX_INSET = 12;
const POT_CORNER = 4;
/** 윤곽선 굵기 1.5pt 의 절반. 선이 영역 밖으로 잘리지 않게 안쪽으로 들인다 */
const OUTLINE_INSET = 0.75;

/** 0 이상 1 미만의 고정된 값. 같은 seed 면 늘 같다 */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function format(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function crackPath(width: number, height: number, kind: CrackKind): string {
  if (width <= 0) return '';

  const spacing = CRACK_SPACING[kind];
  const count = Math.max(1, Math.round(width / spacing));
  const point = (x: number, y: number) =>
    `${format(clamp(x, 0, width))} ${format(clamp(y, 0, height))}`;
  const cracks: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const seed = index * 7 + (kind === 'deep' ? 101 : 1);
    const x = (index + 0.25 + noise(seed) * 0.5) * (width / count);
    const lean = (noise(seed + 1) - 0.5) * spacing * 0.5;

    if (kind === 'fine') {
      // 표면에서 시작해 중간쯤에서 끝나는 짧은 실금
      const depth = height * (0.45 + noise(seed + 2) * 0.35);
      cracks.push(
        `M${point(x, 0)} L${point(x + lean * 0.4, depth * 0.5)} L${point(x + lean, depth)}`,
      );
    } else {
      // 띠를 가로지르고 옆으로 가지를 치는 굵은 균열. 가지는 갔다가 되돌아와 한 획으로 그린다
      const fork = point(x + lean * 0.5, height * 0.4);
      // 가지는 짧게, 본 줄기가 기운 반대쪽으로 낸다. 길면 글자처럼 보인다
      const side = lean >= 0 ? -1 : 1;
      const branch = point(
        x + lean * 0.5 + side * spacing * 0.12,
        height * (0.5 + noise(seed + 3) * 0.15),
      );
      cracks.push(
        `M${point(x, 0)} L${fork} L${branch} L${fork} L${point(x + lean, height * 0.75)} L${point(x + lean * 0.7, height)}`,
      );
    }
  }

  return cracks.join(' ');
}

function potInset(width: number): number {
  return Math.min(POT_MAX_INSET, width * POT_INSET_RATIO);
}

/** 분재용: 위가 넓고 아래가 좁은 얕은 화분 단면. 흙을 이 모양으로 잘라 낸다 */
export function potShapePath(width: number, height: number): string {
  const inset = potInset(width);
  const t = 1 - POT_CORNER / height;

  return [
    `M0 0`,
    `L${format(width)} 0`,
    `L${format(width - inset * t)} ${format(height * t)}`,
    `Q${format(width - inset)} ${format(height)} ${format(width - inset - POT_CORNER)} ${format(height)}`,
    `L${format(inset + POT_CORNER)} ${format(height)}`,
    `Q${format(inset)} ${format(height)} ${format(inset * t)} ${format(height * t)}`,
    'Z',
  ].join(' ');
}

/** 화분 벽과 바닥의 윤곽선. 흙 표면인 윗변은 그리지 않는다 */
export function potOutlinePath(width: number, height: number): string {
  const inset = potInset(width);
  const bottom = height - OUTLINE_INSET;
  const t = 1 - POT_CORNER / height;

  return [
    `M${format(OUTLINE_INSET)} 0`,
    `L${format(OUTLINE_INSET + (inset - OUTLINE_INSET) * t)} ${format(bottom * t)}`,
    `Q${format(inset)} ${format(bottom)} ${format(inset + POT_CORNER)} ${format(bottom)}`,
    `L${format(width - inset - POT_CORNER)} ${format(bottom)}`,
    `Q${format(width - inset)} ${format(bottom)} ${format(width - OUTLINE_INSET - (inset - OUTLINE_INSET) * t)} ${format(bottom * t)}`,
    `L${format(width - OUTLINE_INSET)} 0`,
  ].join(' ');
}
