/**
 * 앱 문구. 존댓말, 느낌표·이모지·대시 문장부호 없음 (SPEC.md 14.4).
 * 화면 코드에는 한국어 문자열을 직접 쓰지 않고 이 키를 쓴다.
 */
export const ko = {
  app: {
    name: '물때',
  },
  today: {
    title: '오늘',
    empty: '첫 공간을 등록해보세요',
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
  error: {
    database: '데이터를 준비하지 못했어요. 앱을 다시 실행해 주세요.',
  },
} as const;
