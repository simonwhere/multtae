import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { getSetting } from '@/db/settings';

/** 'unknown' 은 아직 읽는 중이다 */
export type OnboardingState = 'unknown' | 'needed' | 'done';

/**
 * 첫 실행인지 본다 (SPEC.md 3.1). DB 를 읽으므로 마이그레이션이 끝난 뒤(ready)에만 돈다.
 * 온보딩을 마치거나 건너뛰면 settings.onboarding_done 이 남아 다시 띄우지 않는다.
 */
export function useOnboarding(ready: boolean): OnboardingState {
  const [state, setState] = useState<OnboardingState>('unknown');

  useEffect(() => {
    if (!ready) return;
    void getSetting(db, 'onboarding_done').then((value) =>
      setState(value === 'true' ? 'done' : 'needed'),
    );
  }, [ready]);

  return state;
}
