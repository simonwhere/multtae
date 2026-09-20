/**
 * 번들 시드 30종과 텍스트 검색 (SPEC.md 16장 2-2).
 *
 * 서버 종 DB(3-1~3-4)가 생기기 전까지, 그리고 그 뒤에도 오프라인일 때 쓰는 최소 목록이다.
 * 구성은 10.5 의 대표 종에서 식물군 비율대로 골랐다: 관엽 11, 다육 6, 온대 5, 허브 4, 분재 4.
 * baseInterval 은 봄·중광·중형 화분·배양토 기준 일수이고, 식물군 기본값과 크게 다른 잘 알려진 종만 넣었다.
 * 나머지(null)는 식물군 기본값을 쓴다. 3-4 에서 서버가 만든 값으로 바뀐다.
 * 학명은 현재 통용되는 이름이고, 옛 학명은 synonyms 에 두어 검색에 쓴다.
 */
import type { BonsaiGroup } from '../db/schema';
import type { GroupCode } from '../engine/types';

export interface SeedSpecies {
  /** 종 DB 의 키 */
  scientificName: string;
  /** 국명. 유통명 우선 */
  nameKo: string;
  aliasesKo: string[];
  /** 검색용 옛 학명 */
  synonyms: string[];
  groupCode: GroupCode;
  baseInterval: number | null;
  bonsaiGroup: BonsaiGroup | null;
}

type Entry = [
  scientificName: string,
  nameKo: string,
  aliasesKo: string[],
  baseInterval?: number,
  synonyms?: string[],
];

function group(
  groupCode: GroupCode,
  bonsaiGroup: BonsaiGroup | null,
  entries: Entry[],
): SeedSpecies[] {
  return entries.map(([scientificName, nameKo, aliasesKo, baseInterval, synonyms]) => ({
    scientificName,
    nameKo,
    aliasesKo,
    synonyms: synonyms ?? [],
    groupCode,
    baseInterval: baseInterval ?? null,
    bonsaiGroup,
  }));
}

export const SEED_SPECIES: SeedSpecies[] = [
  ...group('tropical', null, [
    ['Monstera deliciosa', '몬스테라', ['몬스테라 델리시오사'], 7],
    ['Epipremnum aureum', '스킨답서스', ['스킨', '포토스']],
    ['Ficus elastica', '인도고무나무', ['고무나무'], 10],
    ['Spathiphyllum wallisii', '스파티필럼', ['스파티필름', '스파트필름'], 5],
    ['Goeppertia makoyana', '칼라데아 마코야나', ['칼라데아', '칼라테아'], undefined, [
      'Calathea makoyana',
    ]],
    ['Alocasia odora', '알로카시아', ['알로카시아 오도라']],
    ['Dracaena fragrans', '행운목', ['드라세나', '맛상게아나']],
    ['Chamaedorea elegans', '테이블야자', ['탁상야자']],
    ['Philodendron hederaceum', '필로덴드론', ['하트 필로덴드론']],
    ['Peperomia obtusifolia', '페페로미아', ['청페페']],
    ['Nephrolepis exaltata', '보스턴고사리', ['고사리'], 5],
  ]),
  ...group('succulent', null, [
    ['Dracaena trifasciata', '산세베리아', ['산세비에리아'], 21, ['Sansevieria trifasciata']],
    ['Dracaena angolensis', '스투키', ['스투키 산세베리아'], 21, [
      'Sansevieria cylindrica',
      'Sansevieria stuckyi',
    ]],
    ['Echeveria elegans', '에케베리아', ['에케베리아 엘레강스']],
    ['Haworthiopsis attenuata', '하월시아', ['십이지권'], undefined, ['Haworthia attenuata']],
    ['Aloe vera', '알로에', ['알로에 베라']],
    ['Opuntia microdasys', '백도선 선인장', ['선인장', '토끼 선인장'], 21],
  ]),
  ...group('temperate', null, [
    ['Ficus benjamina', '벤자민고무나무', ['벤자민']],
    ['Olea europaea', '올리브나무', ['올리브']],
    ['Hedera helix', '아이비', ['헤데라']],
    ['Zamioculcas zamiifolia', '금전수', ['돈나무', '자미오쿨카스'], 14],
    ['Heptapleurum arboricola', '홍콩야자', ['쉐플레라'], undefined, ['Schefflera arboricola']],
  ]),
  ...group('herb', null, [
    ['Ocimum basilicum', '바질', ['스위트 바질']],
    ['Salvia rosmarinus', '로즈마리', [], 5, ['Rosmarinus officinalis']],
    ['Mentha spicata', '스피어민트', ['민트']],
    ['Pelargonium × hortorum', '제라늄', ['페라고늄']],
  ]),
  ...group('bonsai_conifer', 'conifer', [
    ['Pinus thunbergii', '곰솔', ['흑송', '해송']],
    ['Pinus densiflora', '소나무', ['적송']],
  ]),
  ...group('bonsai_deciduous', 'deciduous', [['Acer palmatum', '단풍나무', ['단풍']]]),
  ...group('bonsai_deciduous', 'flowering', [
    ['Rhododendron indicum', '영산홍', ['철쭉', '사쓰끼']],
  ]),
];

export function findSeedSpecies(scientificName: string): SeedSpecies | undefined {
  return SEED_SPECIES.find((species) => species.scientificName === scientificName);
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '');

/** 낮을수록 잘 맞는다. 맞지 않으면 null */
function matchRank(species: SeedSpecies, query: string): number | null {
  const name = normalize(species.nameKo);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;

  const others = [...species.aliasesKo, species.scientificName, ...species.synonyms].map(normalize);
  if (others.some((text) => text.startsWith(query))) return 3;
  if (others.some((text) => text.includes(query))) return 4;
  return null;
}

/** 국명·별칭·학명·옛 학명에서 찾는다. 검색어가 없으면 전부를 가나다순으로 */
export function searchSpecies(query: string): SeedSpecies[] {
  const byName = (a: SeedSpecies, b: SeedSpecies) => a.nameKo.localeCompare(b.nameKo, 'ko');
  const normalized = normalize(query);
  if (normalized === '') return [...SEED_SPECIES].sort(byName);

  return SEED_SPECIES.map((species) => ({ species, rank: matchRank(species, normalized) }))
    .filter((match): match is { species: SeedSpecies; rank: number } => match.rank !== null)
    .sort((a, b) => a.rank - b.rank || byName(a.species, b.species))
    .map((match) => match.species);
}
