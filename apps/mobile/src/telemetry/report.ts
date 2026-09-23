/**
 * 오류 보고 (SPEC.md 13.2 모니터링, 15 개인정보).
 *
 * 지금은 개발 중에만 콘솔에 남기고 아무 데도 보내지 않는다. Sentry 는 네이티브 모듈이라
 * Expo Go 에서는 돌지 않아 개발 빌드를 만드는 8-3 에서 여기 initSentry·captureException 을 연결한다.
 * 그때도 보내는 것은 크래시와 오류뿐이고, 사진·식물·공간 같은 사용자 데이터는 넣지 않는다
 * (CLAUDE.md 절대 규칙). where 에는 어디서 났는지만 적고 사용자가 쓴 글은 넣지 않는다.
 */

export interface ErrorReport {
  /** 어디서 났는지. 'weather.sync' 처럼 기능 이름만 적는다 */
  where: string;
  error: unknown;
}

export function reportError({ where, error }: ErrorReport): void {
  if (__DEV__) console.warn(`[${where}]`, error);
  // 8-3: Sentry.captureException(error, { tags: { where } })
}
