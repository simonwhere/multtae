/**
 * 앱 문구. 존댓말, 느낌표·이모지·대시 문장부호 없음 (SPEC.md 14.4).
 * 화면 코드에는 한국어 문자열을 직접 쓰지 않고 이 키를 쓴다.
 */
export const ko = {
  app: {
    name: '물때',
  },
  common: {
    next: '다음',
    back: '이전',
    close: '닫기',
    save: '저장',
    edit: '수정',
  },
  today: {
    title: '오늘',
    empty: '첫 공간을 등록해보세요',
    registerSpace: '공간 등록',
    addSpace: '공간 추가',
    spaces: '등록한 공간',
    spaceLimit: '공간은 20개까지 등록할 수 있어요',
    registerPlant: '식물 등록',
    plants: '등록한 식물',
    noPlants: '이제 이 공간에 식물을 놓아 보세요',
    plantLimit: '식물은 200개까지 등록할 수 있어요',
  },
  action: {
    watered: '물 줬어요',
    postpone: '내일로',
  },
  /** 흙 게이지의 스크린리더 문구. 키는 SoilStatus */
  soilGauge: {
    moist: '흙이 촉촉해요',
    due: '물 줄 때예요',
    overdue: '물주기가 밀렸어요',
  },
  /** 키는 Direction */
  direction: {
    S: '남',
    E: '동',
    W: '서',
    N: '북',
    unknown: '모름',
  },
  /** 공간 이름에 붙이는 방향. 모름은 붙이지 않는다 */
  directionName: {
    S: '남향',
    E: '동향',
    W: '서향',
    N: '북향',
  },
  /** 키는 SpaceType */
  spaceType: {
    indoor_window: '실내 창가',
    balcony_ext: '발코니 확장',
    terrace: '테라스·옥외',
    indoor_far: '창에서 먼 실내',
  },
  spaceTypeHint: {
    indoor_window: '창 바로 앞이나 창턱',
    balcony_ext: '거실과 이어지게 넓힌 발코니',
    terrace: '바깥 공기를 그대로 받는 자리',
    indoor_far: '창에서 2m 넘게 떨어진 자리',
  },
  /** 공간 이름 제안에 쓰는 유형 이름 */
  spaceTypeName: {
    indoor_window: '실내 창가',
    balcony_ext: '발코니 확장',
    terrace: '테라스',
    indoor_far: '창에서 먼 실내',
  },
  /** 키는 LightGrade */
  lightGrade: {
    high: '강광',
    medium: '중광',
    low: '약광',
    very_low: '저광',
  },
  /** 9.2 판정 기준을 풀어 쓴 설명 */
  lightGradeHint: {
    high: '직사광이 하루 4시간 넘게 드는 자리예요',
    medium: '밝지만 직사광은 2시간 안쪽인 자리예요',
    low: '창에서 조금 떨어졌거나 빛이 가려지는 자리예요',
    very_low: '창이 멀어 빛이 거의 닿지 않는 자리예요',
  },
  /** 키는 GroupCode. SPEC 5.1 의 식물군 이름 */
  groupName: {
    succulent: '다육·선인장',
    tropical: '열대 관엽',
    temperate: '온대 관엽·실내수목',
    herb: '허브·초화·채소',
    bonsai_conifer: '침엽 분재',
    bonsai_deciduous: '잡목·화목 분재',
  },
  /** 종을 모를 때 식물군을 고르는 데 쓰는 예시 */
  groupHint: {
    tropical: '몬스테라, 고무나무, 스킨답서스',
    temperate: '벤자민, 올리브, 아이비',
    succulent: '에케베리아, 산세베리아, 선인장',
    herb: '바질, 로즈마리, 제라늄, 상추',
  },
  /** 키는 PotSize */
  potSize: {
    s: '소',
    m: '중',
    l: '대',
    xl: '특대',
  },
  potSizeHint: {
    s: '지름 12cm 이하. 한 손에 쏙 들어와요',
    m: '지름 13~20cm. 한 뼘 안쪽이에요',
    l: '지름 21~30cm. 한 뼘을 넘어요',
    xl: '지름 30cm 초과. 두 손으로 들어야 해요',
  },
  /** 계산식에 쓰는 이름 */
  potSizeName: {
    s: '소형',
    m: '중형',
    l: '대형',
    xl: '특대형',
  },
  /** 키는 SoilType */
  soilType: {
    potting: '일반 배양토',
    gritty: '마사 섞음',
    akadama: '적옥토·분재용',
    hydro: '수경',
  },
  soilTypeHint: {
    potting: '화원에서 심어 준 그대로라면 대부분 이 흙이에요',
    gritty: '굵은 모래가 섞여 물이 빨리 빠져요',
    akadama: '알갱이 흙이라 아주 빨리 말라요',
    hydro: '흙 없이 물에 담가 키워요',
  },
  soilTypeName: {
    potting: '배양토',
    gritty: '마사',
    akadama: '적옥토',
    hydro: '수경',
  },
  /** 계산식에 쓰는 계절 이름. 키는 Season */
  seasonName: {
    spring: '봄',
    monsoon: '장마',
    heat: '폭염',
    autumn: '가을',
    winter: '겨울',
  },
  /** 키는 BonsaiGroup */
  bonsaiGroup: {
    conifer: '침엽',
    deciduous: '잡목',
    flowering: '화목·실물',
  },
  bonsaiGroupHint: {
    conifer: '소나무, 곰솔, 향나무, 주목',
    deciduous: '단풍, 느티, 소사',
    flowering: '명자, 철쭉, 모과',
  },
  formula: {
    days: (days: string) => `${days}일`,
    learn: '보정',
    hydro: (days: number) => `수경이라 ${days}일마다 물을 갈아요`,
    manual: (days: number) => `직접 정한 주기 ${days}일`,
    monthDay: (month: number, day: number) => `${month}월 ${day}일`,
    dDay: (days: number) => `D-${days}`,
    overdue: (days: number) => `${days}일 밀림`,
  },
  plantRegister: {
    progress: '식물 등록 진행',
    photo: {
      title: '식물 사진을 찍어 주세요',
      guide: '잎이 잘 보이게 찍어주세요',
      count: (count: number, max: number) => `${count}/${max}장. 첫 사진이 대표 사진이에요`,
      camera: '사진 찍기',
      library: '앨범에서 고르기',
      remove: '사진 빼기',
      preview: '고른 식물 사진',
    },
    species: {
      title: '어떤 식물인가요',
      search: '이름으로 찾기',
      placeholder: '몬스테라, 고무나무',
      noResult: '찾는 식물이 없어요. 모르겠어요를 눌러 종류만 골라도 돼요.',
      unknown: '모르겠어요',
      unknownHint: '종류만 골라도 물주기를 계산할 수 있어요',
      chooseGroup: '가장 가까운 종류를 골라 주세요',
    },
    pot: {
      title: '화분은 얼마나 큰가요',
      guide: '화분 윗부분의 지름으로 골라 주세요',
    },
    soil: {
      title: '어떤 흙에 심었나요',
      hydroNote: (days: number) => `수경은 물주기 대신 ${days}일마다 물을 갈아 줘요`,
    },
    space: {
      title: '어디에 두나요',
      empty: '먼저 식물을 둘 공간을 등록해 주세요',
    },
    bonsai: {
      title: '분재로 키우나요',
      toggle: '분재예요',
      guide: '분재는 물주기 대신 흙을 확인하라고 알려 드려요',
      chooseGroup: '수종군을 골라 주세요',
    },
    finish: {
      title: '첫 물주기를 확인해 주세요',
      nickname: '별명',
      lastWatered: '마지막으로 물 준 날',
      today: '오늘',
      yesterday: '어제',
      daysAgo: (days: number) => `${days}일 전`,
      earlier: '전날',
      later: '다음 날',
      unknown: '언제 줬는지 모르겠어요',
      unknownShort: '모름',
      nextWater: '다음 물주기',
      unknownNote: (days: number) =>
        `마지막 물 준 날을 몰라 첫 알림은 주기의 절반인 ${days}일 뒤에 드려요`,
      belowMin: '매일 흙을 확인해 주세요',
      overdueNote: '이미 물 줄 때가 지났어요. 등록하면 오늘 할 일에 나와요.',
    },
    photoProblem: {
      denied: '카메라 권한이 꺼져 있어요. 설정에서 켜거나 앨범에서 골라 주세요.',
      unavailable: '이 기기에서는 카메라를 쓸 수 없어요. 앨범에서 골라 주세요.',
      failed: '사진을 저장하지 못했어요. 다시 시도해 주세요.',
    },
    saveFailed: '식물을 저장하지 못했어요. 다시 시도해 주세요.',
  },
  spaceRegister: {
    progress: '공간 등록 진행',
    photo: {
      title: '공간 사진을 찍어 주세요',
      guide: '창이 보이게 찍어주세요',
      landscape: '가로로 찍으면 공간이 더 잘 담겨요',
      camera: '사진 찍기',
      library: '앨범에서 고르기',
      retake: '다시 고르기',
      preview: '고른 공간 사진',
      cameraDenied: '카메라 권한이 꺼져 있어요. 설정에서 켜거나 앨범에서 골라 주세요.',
      cameraUnavailable: '이 기기에서는 카메라를 쓸 수 없어요. 앨범에서 골라 주세요.',
      failed: '사진을 저장하지 못했어요. 다시 시도해 주세요.',
    },
    direction: {
      title: '창이 어느 쪽을 향하나요',
      guide: '해가 드는 시간으로 가늠해도 돼요. 아침에 들면 동, 한낮이면 남, 오후면 서예요.',
      unknownWarning: '방향을 모르면 빛을 중간 정도로 가정해요. 나중에 공간에서 바꿀 수 있어요.',
    },
    type: {
      title: '어떤 자리인가요',
    },
    light: {
      title: '이 자리의 빛은 이 정도예요',
      basisDefault: '방향과 자리 유형으로 정한 기본값이에요',
      basisManual: '직접 고른 등급이에요',
      choose: '빛 등급을 골라 주세요',
    },
    name: {
      title: '이 공간을 뭐라고 부를까요',
      label: '공간 이름',
      guide: '나중에 바꿀 수 있어요',
    },
    saveFailed: '공간을 저장하지 못했어요. 다시 시도해 주세요.',
  },
  error: {
    database: '데이터를 준비하지 못했어요. 앱을 다시 실행해 주세요.',
  },
} as const;
