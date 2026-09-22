/**
 * 공간 사진으로 빛을 읽는다 (SPEC.md 9.2, 4.1).
 * 사진은 Edge Function 으로만 보내고 서버에 저장하지 않는다 (CLAUDE.md 절대 규칙).
 * 실패하면 앱은 방향 × 유형 기본값 표로 간다. 사용자에게 오류를 따로 보이지 않는다.
 */
import type { Direction, SpaceType } from '@/engine';
import { photoFile } from '@/photos/photo-store';
import { parseLightReading } from '@/spaces/light-reading';
import type { LightReading } from '@/spaces/light-reading';

import { callFunction } from './client';

export type LightGradeOutcome =
  | { kind: 'reading'; reading: LightReading }
  /** 서버가 없거나 닿지 않거나 사진을 읽지 못했다. 기본값 표로 간다 */
  | { kind: 'unavailable' };

/** 비전 호출이라 인식보다 오래 걸린다 */
const TIMEOUT_MS = 45_000;

export async function gradeLight(
  photoPath: string,
  direction: Direction,
  spaceType: SpaceType,
  signal?: AbortSignal,
): Promise<LightGradeOutcome> {
  try {
    const form = new FormData();
    form.append('image', photoFile(photoPath), 'space.jpg');
    form.append('direction', direction);
    form.append('space_type', spaceType);

    const body = await callFunction<{ light: unknown }>('light-grade', {
      method: 'POST',
      body: form,
      timeoutMs: TIMEOUT_MS,
      signal,
    });

    const reading = body && parseLightReading(body.light);
    return reading ? { kind: 'reading', reading } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
