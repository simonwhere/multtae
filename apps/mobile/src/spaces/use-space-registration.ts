import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';

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
  // 한 번에 여러 동작이 와도 최신 초안에서 이어 가도록 따로 들고 있는다.
  const latest = useRef<SpaceDraft | null>(null);

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
    photoProblem,
    saveFailed,
    dispatch,
    pickPhoto,
    save,
  };
}
