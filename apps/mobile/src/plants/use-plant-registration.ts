import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { currentCoefficients } from '@/coefficients';
import { db } from '@/db/client';
import { insertPlant, listPlantsWithSpace } from '@/db/plants';
import type { Space } from '@/db/schema';
import { listSpaces } from '@/db/spaces';
import { getSeasonAt, toCalendarDate } from '@/engine';
import { rescheduleSoon } from '@/notifications';
import { deletePhoto, photoExists, pickPhoto as pickAndStorePhoto } from '@/photos/photo-store';
import type { PhotoProblem, PhotoSource } from '@/photos/photo-store';

import { clearPlantDraft, loadPlantDraft, savePlantDraft } from './draft-store';
import {
  createPlantDraft,
  MAX_PLANT_PHOTOS,
  MAX_PLANTS,
  previewWatering,
  reducePlantDraft,
  toNewPlant,
} from './registration';
import type { PlantDraft, PlantDraftAction } from './registration';

/** 기기 시간대의 지금 UTC 오프셋(분). 물주기 날짜는 기기 로컬 날짜로 센다 (SPEC 12.2) */
const deviceUtcOffsetMinutes = () => -new Date().getTimezoneOffset();

/**
 * 식물 등록 화면의 상태. 바뀔 때마다 초안을 저장해 두므로 중간에 나가도 이어서 할 수 있다 (SPEC 4).
 */
export function usePlantRegistration() {
  /** null 은 불러오는 중 */
  const [draft, setDraft] = useState<PlantDraft | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [existingNicknames, setExistingNicknames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<PhotoProblem | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // 한 번에 여러 동작이 와도 최신 초안에서 이어 가도록 따로 들고 있는다.
  const latest = useRef<PlantDraft | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [plants, saved] = await Promise.all([listPlantsWithSpace(db), loadPlantDraft(db)]);
      if (!alive) return;

      // 사진 파일이 사라진 초안은 남은 사진만 갖고 사진 단계부터 다시 한다.
      const photos = saved?.photos.filter((photo) => photoExists(photo.path)) ?? [];
      const usable =
        saved && photos.length < saved.photos.length
          ? { ...saved, photos, step: 'photo' as const }
          : saved;
      const initial = usable ?? createPlantDraft(randomUUID());

      latest.current = initial;
      setExistingNicknames(plants.map((item) => item.plant.nickname));
      setDraft(initial);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  // 공간 단계에서 공간을 등록하고 돌아오면 목록이 늘어 있어야 한다.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void listSpaces(db).then((rows) => {
        if (alive) setSpaces(rows);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  function dispatch(action: PlantDraftAction) {
    if (!latest.current) return;
    const next = reducePlantDraft(latest.current, action);
    if (next === latest.current) return;

    latest.current = next;
    setDraft(next);
    void savePlantDraft(db, next);
  }

  async function pickPhoto(source: PhotoSource) {
    if (!latest.current || busy || latest.current.photos.length >= MAX_PLANT_PHOTOS) return;

    setBusy(true);
    setPhotoProblem(null);
    const result = await pickAndStorePhoto(source, 'plants', latest.current.id);
    setBusy(false);

    if (result.status === 'picked') {
      dispatch({ type: 'photoAdded', photo: result.photo });
    } else if (result.status !== 'canceled') {
      setPhotoProblem(result.status);
    }
  }

  function removePhoto(path: string) {
    dispatch({ type: 'photoRemoved', path });
    deletePhoto(path);
  }

  const space = spaces.find((item) => item.id === draft?.spaceId) ?? null;
  const now = Date.now();
  const season = getSeasonAt(now, currentCoefficients().seasonBounds);
  const preview =
    draft && space
      ? previewWatering(
          draft,
          space,
          { today: toCalendarDate(now, deviceUtcOffsetMinutes()), season },
          currentCoefficients(),
        )
      : null;

  /** 저장에 성공하면 true */
  async function save(): Promise<boolean> {
    if (!latest.current || !space || busy) return false;
    const savedAt = Date.now();
    const created = toNewPlant(latest.current, {
      space,
      existingNicknames,
      now: savedAt,
      utcOffsetMinutes: deviceUtcOffsetMinutes(),
      season: getSeasonAt(savedAt, currentCoefficients().seasonBounds),
      coefficients: currentCoefficients(),
    });
    if (!created) return false;

    setBusy(true);
    setSaveFailed(false);
    try {
      await insertPlant(db, created.plant, created.photos);
      await clearPlantDraft(db);
      rescheduleSoon();
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
    spaces,
    space,
    preview,
    existingNicknames,
    atLimit: existingNicknames.length >= MAX_PLANTS,
    busy,
    photoProblem,
    saveFailed,
    dispatch,
    pickPhoto,
    removePhoto,
    save,
  };
}
