import { create } from 'zustand';

interface PlantUiState {
  /** 방금 "물 줬어요"를 마친 식물. 오늘 탭이 이 카드의 흙 게이지를 마른 데서부터 채워 보여 준다 (SPEC 14.1) */
  justWateredId: string | null;
  markWatered: (plantId: string) => void;
  clearWatered: () => void;
  /** 화면 밖에서 식물이 바뀌면(계절 전환 재계산) 올라간다. 목록을 보여 주는 화면이 이걸 보고 다시 읽는다 */
  gardenVersion: number;
  bumpGarden: () => void;
}

export const usePlantUi = create<PlantUiState>((set) => ({
  justWateredId: null,
  markWatered: (plantId) => set({ justWateredId: plantId }),
  clearWatered: () => set({ justWateredId: null }),
  gardenVersion: 0,
  bumpGarden: () => set((state) => ({ gardenVersion: state.gardenVersion + 1 })),
}));
