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
    cancel: '취소',
    goBack: '뒤로',
  },
  tabs: {
    today: '오늘',
    spaces: '공간',
    plants: '식물',
    records: '기록',
    add: '등록',
  },
  /** 오늘 탭 상단 배지. 키는 Season (SPEC 3.2) */
  seasonMode: {
    spring: '봄',
    monsoon: '장마',
    heat: '폭염',
    autumn: '가을',
    winter: '겨울·난방',
  },
  seasonInfo: {
    title: (mode: string) => `지금은 ${mode} 모드예요`,
    spring: '평소 주기대로 물을 주면 돼요.',
    monsoon: '습해서 흙이 천천히 말라요. 물 주는 간격을 늘렸어요. 흙이 마른 걸 확인하고 주시고, 받침에 고인 물은 바로 버려 주세요.',
    heat: '흙이 빨리 말라서 물 주는 간격을 줄였어요. 다육과 선인장은 쉬는 때라 오히려 늘렸어요.',
    autumn: '평소 주기대로 물을 주면 돼요.',
    winter: '식물이 천천히 자라는 때라 물 주는 간격을 늘렸어요. 난방으로 공기가 건조하니 잎 끝이 마르면 분무해 주세요.',
    next: (mode: string, date: string) => `${date}부터 ${mode} 모드로 바뀌어요.`,
    open: '계절 모드 설명 보기',
  },
  today: {
    title: '오늘',
    /** 오늘 탭의 큰 날짜 "9.21" */
    date: (month: number, day: number) => `${month}.${day}`,
    weekday: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
    overdue: '밀림',
    due: '오늘 물 줄 식물',
    upcoming: '다가옴',
    done: '오늘 물 줬어요',
    doneBadge: '완료',
    allClear: '오늘은 물 줄 식물이 없어요',
    nextWater: (date: string) => `다음 물주기 ${date}`,
    postponeLimit: '세 번 미뤘어요. 오늘은 흙을 확인해 주세요.',
    empty: '식물을 둘 공간부터 등록해 보세요',
    /** 분재 월동 경고 (SPEC 6.3) */
    winter: {
      deciduous_indoor: (names: string) =>
        `${names} 같은 잡목은 실내에서 겨울을 나면 휴면을 못 해 약해져요. 발코니나 테라스로 옮겨 주세요.`,
      conifer_indoor: (names: string) =>
        `${names}은 바깥에서 겨울을 나는 것이 좋아요. 난방이 닿지 않는 곳으로 옮겨 주세요.`,
    },
    registerSpace: '공간 등록',
    addSpace: '공간 추가',
    spaces: '등록한 공간',
    spaceLimit: '공간은 20개까지 등록할 수 있어요',
    registerPlant: '식물 등록',
    plants: '등록한 식물',
    noPlants: '이제 식물을 등록해 보세요',
    plantLimit: '식물은 200개까지 등록할 수 있어요',
  },
  action: {
    watered: '물 줬어요',
    postpone: '내일로',
    done: '완료',
  },
  wateredSheet: {
    title: (nickname: string) => `${nickname}에 물을 줬어요`,
    soilQuestion: '물 주기 전에 흙은 어땠나요',
    soilGuide: '안 골라도 괜찮아요. 고르면 이 식물에 맞게 물 줄 날을 맞춰 드려요.',
    /** 키는 SoilState */
    soilState: {
      dry: '바싹 말랐어요',
      ok: '적당했어요',
      wet: '아직 축축했어요',
    },
    soilStateHint: {
      dry: '다음부터 조금 더 자주 알려 드려요',
      ok: '지금처럼 알려 드려요',
      wet: '다음부터 조금 더 천천히 알려 드려요',
    },
    leafDroop: '잎이 처졌어요',
    hydroTitle: (nickname: string) => `${nickname}의 물을 갈았어요`,
    /** 분재는 물 주기 전에 흙을 확인한다 (SPEC 6.1) */
    bonsaiTitle: (nickname: string) => `${nickname} 흙은 어땠나요`,
    bonsaiDry: '말랐어요',
    bonsaiDryHint: '물을 주고 다음 확인 날을 다시 세요',
    bonsaiMoist: '아직 촉촉해요',
    bonsaiMoistHint: '오늘은 건너뛰고 내일 다시 봐요',
    waterCloudy: '물이 탁했어요',
    failed: '기록하지 못했어요. 다시 시도해 주세요.',
  },
  registerSheet: {
    title: '무엇을 등록할까요',
    needSpace: '식물을 등록하려면 먼저 공간이 있어야 해요',
  },
  records: {
    title: '기록',
    empty: '아직 기록이 없어요. 물을 주면 여기에 남아요.',
    watered: '물 줌',
    /** 비가 넉넉히 와서 물주기를 건너뛴 날 (SPEC 7.2) */
    rain: '비가 대신 줬어요',
    /** 키는 LoggedSoilState */
    soilState: {
      dry: '바싹 말랐어요',
      ok: '적당했어요',
      wet: '아직 축축했어요',
      skipped: '',
    },
  },
  spacesTab: {
    title: '공간',
    empty: '아직 등록한 공간이 없어요',
    plantCount: (count: number) => `식물 ${count}개`,
  },
  /** 오늘 탭 날씨 (SPEC 3.2, 7.2) */
  weather: {
    condition: {
      clear: '맑음',
      cloudy: '구름 많음',
      overcast: '흐림',
      rain: '비',
      snow: '눈',
    },
    high: (celsius: number) => `${celsius}°`,
    summary: (condition: string, high: number, low: number) =>
      `오늘 ${condition}, 최고 ${high}도, 최저 ${low}도`,
  },
  /** 오늘 탭 경고 카드 (SPEC 3.2, 6.3, 7.2~7.4). 닫으면 그날은 다시 뜨지 않는다 */
  cards: {
    close: '닫기',
    closeLabel: (title: string) => `${title} 카드 닫기`,
    more: (shown: string, rest: number) => `${shown} 외 ${rest}개`,
    heatTitle: '폭염',
    heat: (names: string) => `${names} 흙이 빨리 말라요. 저녁에 흙을 한 번 더 만져 보세요.`,
    coldTitle: '한파 예보',
    cold: (when: 'today' | 'tomorrow', low: number, names: string) =>
      `${when === 'today' ? '오늘' : '내일'} 새벽 ${low}도까지 내려가요. ${names} 화분을 챙겨 주세요.`,
    coldBonsai: '분재 화분은 얼 수 있어요. 발코니 안쪽이나 스티로폼 상자로 보호해 주세요.',
    coldBalcony: '확장 발코니도 새벽에는 5도 아래로 떨어질 수 있어요.',
    frostTitle: '서리 예보',
    frost: (when: 'today' | 'tomorrow', low: number, names: string) =>
      `${when === 'today' ? '오늘' : '내일'} 새벽 ${low}도예요. 서리에 ${names} 새순이 상할 수 있어요.`,
    windTitle: '강풍',
    wind: (names: string) => `${names} 화분이 넘어지지 않게 벽 쪽 낮은 곳으로 옮겨 주세요.`,
    windSmall: (names: string) => `${names}처럼 작은 화분은 특히 잘 넘어져요.`,
    dustTitle: '미세먼지 나쁨',
    dust: '창을 열기 어려운 날이에요. 잎에 물을 뿌려 습도를 채워 주세요.',
    humidityTitle: '난방 중 습도',
    humidity: '난방으로 실내 습도가 30% 아래로 떨어질 수 있어요. 잎 끝이 마르면 가습기를 켜거나 물을 뿌려 주세요.',
    monsoonTitle: '장마 시작',
    monsoon: '장마 동안은 흙이 마른 걸 확인하고 주세요. 받침에 고인 물은 바로 버려 주세요.',
    winterTitle: '겨울나기',
  },
  /** 설정 (SPEC 3.6) */
  settings: {
    title: '설정',
    open: '설정 열기',
    notifications: '알림',
    notifyTime: '알림 시각',
    dnd: '방해금지',
    dndOff: '쓰지 않음',
    range: (start: string, end: string) => `${start}~${end}`,
    bonsai: '분재',
    bonsaiEvening: '더운 날 저녁 확인',
    bonsaiWinter: '겨울 확인 시각',
    weather: '날씨',
    region: '지역',
    regionNone: '고르지 않음',
    regionHint: '고른 지역의 기상청 예보로 비 오는 날과 더위, 추위를 챙겨요. 위치 권한은 쓰지 않아요.',
    today: (low: number, high: number, pop: number) => `오늘 ${low}~${high}도, 비 올 확률 ${pop}%`,
    weatherOff: '지금은 날씨를 받지 못하고 있어요. 물주기 알림은 그대로 와요.',
    info: '정보',
    version: '버전',
    saveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
  },
  /** 알림 시각 고르기 시트 */
  timeSheet: {
    notify_time: '알림을 받을 시각',
    bonsai_evening_time: '더운 날 저녁에 분재 흙을 볼 시각',
    bonsai_winter_time: '겨울에 분재 흙을 볼 시각',
    bonsaiWinterHint: '화분 속 물이 얼지 않게 오전 늦게가 좋아요.',
    dndTitle: '방해금지 시간',
    dndHint: '이 시간에 울릴 알림은 끝나는 시각으로 옮겨요.',
    start: '시작',
    end: '끝',
    dndOff: '방해금지 쓰지 않기',
  },
  /** 날씨 지역 고르기 (SPEC 3.6) */
  regionSheet: {
    title: '지역을 골라 주세요',
    search: '시·군·구 찾기',
    searchPlaceholder: '예: 강남, 수원',
    none: '고르지 않기',
    noneHint: '날씨 안내 없이 물주기 알림만 받아요',
    noResult: '찾는 지역이 없어요',
    sidoBack: '시·도 다시 고르기',
  },
  /** 공간 상세 (SPEC 3.3) */
  spaceDetail: {
    missing: '공간을 찾지 못했어요',
    photo: (name: string) => `${name} 사진`,
    retake: '사진 다시 찍기',
    retakeFailed: '사진을 바꾸지 못했어요. 다시 시도해 주세요.',
    reading: '사진을 보는 중이에요',
    lightTitle: '이 자리의 빛',
    evidence: '사진에서 본 것',
    basisPhoto: '사진을 보고 가늠한 밝기예요',
    basisDefault: '창 방향과 자리로 가늠한 밝기예요',
    basisUnsure: '사진만으로는 또렷하지 않아 창 방향과 자리로 가늠했어요',
    basisManual: '직접 고른 밝기예요',
    editLight: '밝기 바꾸기',
    chooseLight: '이 자리의 밝기를 골라 주세요',
    nameLabel: '공간 이름',
    name: '이름',
    place: '자리',
    saveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
    retakeCamera: '사진 찍기',
    retakeLibrary: '앨범에서 고르기',
    season: (mode: string) => `${mode}에 알아 둘 점`,
    plants: '이 공간의 식물',
    noPlants: '아직 이 공간에 둔 식물이 없어요',
    delete: '공간 지우기',
    /** name 은 조사까지 붙여 넘긴다 (lib/josa withObject) */
    deleteTitle: (nameWithObject: string) => `${nameWithObject} 지울까요`,
    deleteBody: '지우면 되돌릴 수 없어요.',
    deleteBlocked: '이 공간에 식물이 있어 지울 수 없어요. 식물을 다른 공간으로 옮긴 뒤에 지워 주세요.',
    /** 계절 메모 (3.3). 유형과 계절로 고른다 */
    memo: {
      indoorMonsoon: '장마에는 실내도 습해요. 창을 자주 열어 공기를 돌려 주세요.',
      indoorWinter: '난방을 하면 공기가 메말라요. 온풍기나 라디에이터 옆은 피해 주세요.',
      windowHeat: '한낮 유리 너머 볕이 뜨거워요. 잎이 닿으면 얇은 커튼을 쳐 주세요.',
      outdoorMonsoon: '비가 들이치면 실내로 들여 주세요. 받침에 고인 물도 바로 버려 주세요.',
      outdoorHeat: '바람과 볕에 흙이 빨리 말라요. 저녁에 한 번 더 만져 보세요.',
      balconyWinter: '12월에서 2월 사이 새벽에는 5도 아래로 내려갈 수 있어요.',
      terraceSpring: '봄바람이 세면 화분이 넘어질 수 있어요.',
      terraceAutumn: '서리가 내리기 전에 실내로 들일 식물을 정해 두세요.',
      terraceWinter: '밤에는 화분 속 물이 얼 수 있어요.',
    },
  },
  plantsTab: {
    title: '식물',
    empty: '아직 등록한 식물이 없어요',
  },
  /** 식물 상세 (SPEC 3.4). 계산식은 보여 주지 않고 결과만 말한다 */
  plantDetail: {
    nextWater: '다음 물주기',
    lastWatered: (date: string) => `마지막으로 물 준 날 ${date}`,
    lastWateredUnknown: '아직 물 준 기록이 없어요',
    bonsai: '분재',
    info: '식물 정보',
    space: '공간',
    pot: '화분',
    soil: '흙',
    interval: '물주기',
    intervalAuto: '자동',
    intervalManual: '직접 정함',
    nickname: '별명',
    history: '최근 물주기',
    historyEmpty: '아직 물 준 기록이 없어요',
    historyMore: '기록 더 보기',
    repotted: (date: string) => `마지막 분갈이 ${date}`,
    delete: '식물 삭제',
    deleteTitle: '이 식물을 삭제할까요',
    deleteBody: '물주기 기록과 사진도 함께 지워져요. 되돌릴 수 없어요.',
    deleteConfirm: '삭제',
    notFound: '식물을 찾을 수 없어요',
    /** 분재 작업 캘린더 (6.2) */
    tasks: '이번 달 할 일',
    taskDone: '했어요',
    taskUndo: '안 했어요로',
    taskNext: (month: number, label: string) => `다음 작업은 ${month}월 ${label}이에요`,
    taskMonths: (start: number, end: number) =>
      start === end ? `${start}월` : `${start}~${end}월`,
    /** 관리 카드 (3.4). 종 DB 에서 받아 둔 것이 있을 때만 보여 준다 */
    care: '키우는 법',
    careLight: '빛',
    careWater: '물',
    careHumidity: '습도',
    careTemp: '온도',
    careSoil: '흙',
    careTempRange: (min: number, max: number) => `${min}~${max}도`,
    careTempMin: (min: number) => `${min}도 이상`,
    careToxic: '반려동물에게 독성이 있어요',
    /** 같은 흙 상태가 세 번 이어졌을 때 (5.4). 키는 흙 상태 */
    streak: {
      wet: '물 줄 때마다 흙이 아직 축축했어요. 이 식물은 물을 덜 줘도 되는 것 같아요.',
      dry: '물 줄 때마다 흙이 바싹 말라 있었어요. 이 식물은 물을 더 자주 줘야 할 것 같아요.',
      action: '물주기 직접 정하기',
    },
    /** 직접 정한 주기가 있는데 계절이 바뀌었을 때 한 번 묻는다 (5.5) */
    seasonQuestion: {
      title: (mode: string) => `${mode} 모드로 바뀌었어요`,
      body: (days: number) => `직접 정한 ${days}일 간격을 계속 쓸까요, 계절에 맞춰 자동으로 바꿀까요`,
      keep: '그대로 둘게요',
      auto: '자동으로 바꾸기',
    },
  },
  plantEdit: {
    rename: {
      title: '별명 바꾸기',
      label: '별명',
    },
    interval: {
      title: '물주기 정하기',
      auto: (days: string) => `자동 · ${days}`,
      autoHint: '계절과 자리에 맞춰 알아서 바꿔 드려요',
      manual: '직접 정하기',
      manualHint: '정한 간격 그대로 알려 드려요',
      days: (days: number) => (days === 1 ? '매일' : `${days}일마다`),
      fewer: '하루 줄이기',
      more: '하루 늘리기',
    },
    repot: {
      title: '분갈이했어요',
      guide: '화분이나 흙이 바뀌면 물 줄 날을 새로 맞춰 드려요',
      pot: '화분 크기',
      soil: '흙',
    },
    move: {
      title: '어디로 옮겼나요',
      guide: '옮긴 자리의 빛에 맞춰 물 줄 날을 다시 맞춰 드려요',
    },
    saveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
  },
  /** 로컬 알림의 제목과 본문 (SPEC 12.1) */
  notifications: {
    /** 안드로이드 알림 채널 이름 */
    channel: '물주기 알림',
    /** 식물명은 shown 만큼만 적고 나머지는 "외 N개" (12.2 묶기) */
    names: (shown: readonly string[], total: number) => {
      if (total === 1) return shown[0];
      const list = shown.join(', ');
      return total > shown.length ? `${list} 외 ${total - shown.length}개` : `${list} ${total}개`;
    },
    waterTitle: '물때예요',
    waterBody: (names: string) => `${names} 물 줄 때`,
    /** 수경은 물주기 대신 물 교체 (4.2) */
    hydroBody: (names: string) => `${names} 물 갈 때`,
    /** 분재는 물을 주는 대신 흙을 확인한다 (SPEC 6.1) */
    bonsaiTitle: '흙 확인할 때',
    bonsaiBody: (names: string) => `${names} 흙이 말랐는지 봐 주세요`,
    /** 분재 작업 알림 (SPEC 12.1). 시작 월 1일 아침 */
    taskTitle: '이번 달 할 일',
    taskBody: (names: string) => `${names} 할 때예요`,
    overdueTitle: '물주기가 밀렸어요',
    overdueOne: (name: string, days: number) => `${name} ${days}일 지났어요`,
    overdueMany: (names: string) => `${names} 물 줄 날이 지났어요`,
    seasonTitle: (mode: string) => `${mode} 모드`,
    /** 새 계절에 내 식물들의 주기가 어떻게 바뀌나 */
    seasonTrend: {
      longer: '물주기가 전체적으로 늘었어요',
      shorter: '물주기가 전체적으로 줄었어요',
      same: '물주기는 그대로예요',
    },
    /** 다른 알림에 한 줄로 합칠 때 */
    seasonLine: (mode: string, trend: string) => `오늘부터 ${mode} 모드, ${trend}`,
    /** 한파·서리 예보 알림 (12.1) */
    weatherTitle: { cold: '한파 예보', frost: '서리 예보' },
    weatherBody: (low: number, count: number) =>
      `내일 새벽 ${low}도, 바깥에 둔 식물 ${count}개를 챙겨 주세요`,
    /** 알림 권한이 꺼져 있을 때 오늘 탭 상단 배너 (12.2) */
    offTitle: '알림이 꺼져 있어요',
    offBody: '설정에서 알림을 켜면 물 줄 날을 알려 드려요.',
    openSettings: '설정 열기',
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
  /** 날짜와 주기 표기 */
  format: {
    monthDay: (month: number, day: number) => `${month}월 ${day}일`,
    dDay: (days: number) => (days === 0 ? '오늘' : `D-${days}`),
    overdue: (days: number) => `${days}일 지남`,
    every: (days: number) => (days === 1 ? '매일 물을 줘요' : `${days}일마다 물을 줘요`),
    hydroEvery: (days: number) => `${days}일마다 물을 갈아 줘요`,
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
      noResult: '찾는 식물이 없으면 모르겠어요를 누르고 종류만 골라 주세요.',
      searching: '찾고 있어요',
      unknown: '모르겠어요',
      unknownHint: '종류만 알아도 물 줄 날을 알려 드릴 수 있어요',
      chooseGroup: '가장 가까운 종류를 골라 주세요',
      /** 사진 인식 (SPEC 4.2, 9.1) */
      identifying: '사진을 보고 있어요',
      identifyWait: '잠시만 기다려 주세요',
      candidates: '이 식물인가요',
      candidateHint: (score: number) => `사진과 ${Math.round(score * 100)}% 닮았어요`,
      loadingSpecies: '키우는 법을 가져오고 있어요',
      noMatch: '닮은 식물을 찾지 못했어요. 이름으로 찾아 주세요.',
      limit: '오늘은 사진 인식이 많아 이름으로 찾도록 도와드릴게요.',
      unavailable: '사진으로 찾지 못했어요. 이름으로 찾아 주세요.',
      searchInstead: '이름으로 찾기',
      retry: '다시 찾아보기',
      notFound: '이 식물의 정보를 아직 못 구했어요. 종류만 골라 주세요.',
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
      guide: '분재는 물 줄 날 대신 흙을 확인할 때를 알려 드려요',
      chooseGroup: '어떤 나무에 가까운가요',
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
      unknownNote: (days: number) => `언제 줬는지 몰라서 첫 알림은 ${days}일 뒤에 드릴게요`,
      belowMin: '매일 흙을 확인해 주세요',
      overdueNote: '물 줄 때가 이미 지났어요. 등록하면 오늘 탭에서 바로 볼 수 있어요.',
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
      unknownWarning: '방향을 모르면 빛을 중간 정도로 볼게요. 나중에 바꿀 수 있어요.',
    },
    type: {
      title: '어떤 자리인가요',
    },
    light: {
      title: '이 자리의 빛은 이 정도예요',
      reading: '사진을 보는 중이에요',
      readingWait: '몇 초면 끝나요',
      basisPhoto: '사진을 보고 가늠한 밝기예요. 실제와 다르면 바꿔 주세요.',
      basisDefault: '창 방향과 자리로 가늠한 밝기예요. 실제와 다르면 바꿔 주세요.',
      basisUnsure: '사진만으로는 또렷하지 않아 창 방향과 자리로 가늠했어요. 실제와 다르면 바꿔 주세요.',
      basisManual: '직접 고른 밝기예요',
      evidence: '사진에서 본 것',
      choose: '이 자리의 밝기를 골라 주세요',
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
