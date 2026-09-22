import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';

import { gradeLight } from '@/api/light-grade';
import { db } from '@/db/client';
import { insertSpace, listSpaces } from '@/db/spaces';
import { deletePhoto, photoExists, pickPhoto as pickAndStorePhoto } from '@/photos/photo-store';
import type { PhotoProblem, PhotoSource } from '@/photos/photo-store';

import { clearSpaceDraft, loadSpaceDraft, saveSpaceDraft } from './draft-store';
import { createSpaceDraft, MAX_SPACES, reduceSpaceDraft, toNewSpace } from './registration';
import type { SpaceDraft, SpaceDraftAction } from './registration';

/**
 * 공간 등록 화면의 상태. 바뀔 때마다 초안을 저장해 두므로 중간에 나가도 이어서 할 수 있다 (SPEC 4).
 */
export function useSpaceRegistration() {
  /** null 은 불러오는 중 */
  const [draft, setDraft] = useState<SpaceDraft | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<PhotoProblem | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /** 사진으로 빛을 읽는 중 */
  const [readingLight, setReadingLight] = useState(false);
  // 한 번에 여러 동작이 와도 최신 초안에서 이어 가도록 따로 들고 있는다.
  const latest = useRef<SpaceDraft | null>(null);
  /** 지금 서버에 물어보고 있는 사진·방향·유형. 같은 것을 겹쳐 묻지 않는다 */
  const asking = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [spaces, saved] = await Promise.all([listSpaces(db), loadSpaceDraft(db)]);
      if (!alive) return;

      // 사진 파일이 사라진 초안은 사진 단계부터 다시 한다.
      const usable =
        saved?.photoPath && !photoExists(saved.photoPath)
          ? { ...saved, photoPath: null, step: 'photo' as const }
          : saved;
      const initial = usable ?? createSpaceDraft(randomUUID());

      latest.current = initial;
      setExistingNames(spaces.map((space) => space.name));
      setDraft(initial);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  // 빛 등급 단계에 오면 사진을 한 번 보낸다 (SPEC 4.1, 9.2).
  // 읽지 못해도 화면은 방향 × 유형으로 가늠한 값을 보여 주므로 오류를 따로 알리지 않는다.
  useEffect(() => {
    if (!draft || draft.step !== 'light') return;

    const { photoPath, direction, spaceType } = draft;
    if (!photoPath || !direction || !spaceType || draft.aiLight) return;

    const key = `${photoPath}|${direction}|${spaceType}`;
    if (asking.current === key) return;
    asking.current = key;

    const controller = new AbortController();
    setReadingLight(true);

    void gradeLight(photoPath, direction, spaceType, controller.signal).then((outcome) => {
      asking.current = null;
      setReadingLight(false);
      if (controller.signal.aborted) return;
      dispatch({ type: 'lightRead', reading: outcome.kind === 'reading' ? outcome.reading : null });
    });

    // 이 단계를 떠나면 그만둔다. 다시 오면 처음부터 묻는다
    return () => controller.abort();
    // 읽은 값(aiLight)은 일부러 빼 두었다. 답이 도착할 때 이 효과가 다시 돌면 안 된다
  }, [draft?.step, draft?.photoPath, draft?.direction, draft?.spaceType]);

  function dispatch(action: SpaceDraftAction) {
    if (!latest.current) return;
    const next = reduceSpaceDraft(latest.current, action);
    if (next === latest.current) return;

    latest.current = next;
    setDraft(next);
    void saveSpaceDraft(db, next);
  }

  async function pickPhoto(source: PhotoSource) {
    if (!latest.current || busy) return;

    setBusy(true);
    setPhotoProblem(null);
    const result = await pickAndStorePhoto(source, 'spaces', latest.current.id);
    setBusy(false);

    if (result.status === 'picked') {
      const previous = latest.current.photoPath;
      dispatch({ type: 'photoPicked', photoPath: result.photo.path });
      if (previous) deletePhoto(previous);
    } else if (result.status !== 'canceled') {
      setPhotoProblem(result.status);
    }
  }

  /** 저장에 성공하면 true */
  async function save(): Promise<boolean> {
    const space = latest.current && toNewSpace(latest.current, existingNames, Date.now());
    if (!space || busy) return false;

    setBusy(true);
    setSaveFailed(false);
    try {
      await insertSpace(db, space);
      await clearSpaceDraft(db);
      return true;
    } catch {
      setSaveFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    draft,
    existingNames,
    atLimit: existingNames.length >= MAX_SPACES,
    busy,
    readingLight,
    photoProblem,
    saveFailed,
    dispatch,
    pickPhoto,
    save,
  };
}
