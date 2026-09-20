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
