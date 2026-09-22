/**
 * 병해충·상태 진단 (SPEC.md 8.1, 9.3). 사진은 Edge Function 으로만 보내고 서버에 저장하지 않는다.
 */
import { parseDiagnosis } from '@/diagnose/diagnosis';
import type { Diagnosis } from '@/diagnose/diagnosis';
import type { GroupCode, LoggedSoilState } from '@/engine';
import { photoFile } from '@/photos/photo-store';

import { callFunction, FunctionError } from './client';

export type DiagnoseOutcome =
  | { kind: 'diagnosis'; diagnosis: Diagnosis; remaining: number }
  /** 오늘 이 기기의 진단을 다 썼다 (기기당 하루 3회) */
  | { kind: 'limit' }
  /** 서버에 닿지 않거나 답이 이상하다 */
  | { kind: 'unavailable' };

export interface DiagnoseRequest {
  photoPaths: readonly string[];
  deviceId: string;
  /** 종 이름(국명 또는 학명). 모르면 null */
  species: string | null;
  groupCode: GroupCode;
  /** 최근 물주기, 최근 것부터 최대 5건 */
  recent: { date: string; soilState: LoggedSoilState; leafDroop: boolean }[];
}

/** 비전 호출이라 시간이 걸린다. 한 번 더 만들 수도 있어 넉넉히 잡는다 */
const TIMEOUT_MS = 90_000;

export async function diagnosePlant(request: DiagnoseRequest): Promise<DiagnoseOutcome> {
  try {
    const form = new FormData();
    for (const [index, path] of request.photoPaths.entries()) {
      form.append('images', photoFile(path), `plant-${index + 1}.jpg`);
    }
    form.append('device_id', request.deviceId);
    form.append('group_code', request.groupCode);
    if (request.species) form.append('species', request.species);
    form.append('recent', JSON.stringify(request.recent.slice(0, 5)));

    const body = await callFunction<{ diagnosis: unknown; remaining: unknown }>('diagnose', {
      method: 'POST',
      body: form,
      timeoutMs: TIMEOUT_MS,
    });
    const diagnosis = body && parseDiagnosis(body.diagnosis);
    if (!diagnosis) return { kind: 'unavailable' };
    return {
      kind: 'diagnosis',
      diagnosis,
      remaining: typeof body.remaining === 'number' ? body.remaining : 0,
    };
  } catch (error) {
    if (error instanceof FunctionError && error.code === 'limit') return { kind: 'limit' };
    return { kind: 'unavailable' };
  }
}
