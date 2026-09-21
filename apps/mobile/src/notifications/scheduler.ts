/**
 * rescheduleAll (SPEC.md 12.3): 앞으로 14일치 알림을 다시 예약한다.
 * 알림을 실제로 다루는 쪽은 Notifier 로 받아서, 규칙은 Node 에서 가짜 Notifier 로 테스트한다.
 *
 * 기존 예약을 전부 취소하고 시작하지 않는다. iOS 의 전체 취소는 비동기라 바로 뒤에 넣은 예약까지 지울 수 있고,
 * 그러면 가장 가까운 알림이 빠진다. 대신 계획에 없는 id 만 지우고 나머지는 같은 id 로 덮어쓴다. 결과는 같다.
 */
import { listPlantsWithSpace, updatePlant } from '../db/plants';
import { listPlantTasks } from '../db/tasks';
import { getSetting } from '../db/settings';
import type { Database } from '../db/types';
import { getSeasonAt, toCalendarDate } from '../engine';
import type { Coefficients } from '../engine';
import { planReschedule } from '../plants/schedule';
import { forecast } from './forecast';
import { planNotifications } from './plan';
import type { PlannedNotification } from './plan';
import { parseNotificationSettings } from './settings';

export interface Notifier {
  /** 알림을 띄울 수 있는가. 권한이 없으면 예약을 건너뛴다 (12.2 권한 없음) */
  canNotify(): Promise<boolean>;
  /** 지금 예약되어 있는 알림의 id */
  scheduledIds(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  /** 같은 id 의 예약이 있으면 덮어쓴다 */
  schedule(notification: PlannedNotification): Promise<void>;
}

export interface RescheduleClock {
  now: number;
  /** 기기 시간대의 UTC 오프셋(분) */
  utcOffsetMinutes: number;
  coefficients: Coefficients;
}

export interface RescheduleResult {
  /** 다음 물주기를 고쳐 쓴 식물 수. 0 이 아니면 화면을 다시 읽어야 한다 */
  updatedPlants: number;
  scheduled: PlannedNotification[];
}

export async function rescheduleAll(
  db: Database,
  notifier: Notifier,
  clock: RescheduleClock,
): Promise<RescheduleResult> {
  const { now, utcOffsetMinutes, coefficients } = clock;
  const context = {
    today: toCalendarDate(now, utcOffsetMinutes),
    // 계절은 Asia/Seoul 날짜로 판정한다 (SPEC 15)
    season: getSeasonAt(now, coefficients.seasonBounds),
    coefficients,
    utcOffsetMinutes,
  };

  // 1. 계절·계수·공간이 바뀌었으면 다음 물주기를 다시 센다 (시나리오 C). 알림 권한과 무관하다
  const items = await listPlantsWithSpace(db);
  let updatedPlants = 0;
  for (const item of items) {
    const patch = planReschedule(item.plant, item.space, context);
    if (!patch) continue;
    await updatePlant(db, item.plant.id, patch);
    item.plant = { ...item.plant, ...patch };
    updatedPlants += 1;
  }

  if (!(await notifier.canNotify())) return { updatedPlants, scheduled: [] };

  // 2. 14일치를 짠다
  const settings = parseNotificationSettings({
    notifyTime: await getSetting(db, 'notify_time'),
    dndStart: await getSetting(db, 'dnd_start'),
    dndEnd: await getSetting(db, 'dnd_end'),
    bonsaiEveningTime: await getSetting(db, 'bonsai_evening_time'),
    bonsaiWinterTime: await getSetting(db, 'bonsai_winter_time'),
  });
  // 분재 작업은 시작 월 1일에 알린다 (6.2). 분재가 없으면 읽지 않는다
  const tasks: { nickname: string; labelKo: string; monthStart: number }[] = [];
  for (const { plant } of items.filter((item) => item.plant.isBonsai)) {
    for (const task of await listPlantTasks(db, plant.id)) {
      tasks.push({ nickname: plant.nickname, labelKo: task.labelKo, monthStart: task.monthStart });
    }
  }

  const scheduled = planNotifications({
    ...forecast(items, clock),
    tasks,
    now,
    utcOffsetMinutes,
    settings,
  });

  // 3. 계획에서 빠진 예약을 지우고, 계획한 알림을 예약한다
  const planned = new Set(scheduled.map((notification) => notification.id));
  for (const id of await notifier.scheduledIds()) {
    if (!planned.has(id)) await notifier.cancel(id);
  }
  for (const notification of scheduled) {
    await notifier.schedule(notification);
  }
  return { updatedPlants, scheduled };
}

/**
 * 겹친 요청을 하나로 모은다. 앱 진입·물주기 기록·내일로가 거의 동시에 다시 예약을 부르므로,
 * 도는 중에 들어온 요청은 끝난 뒤 한 번만 더 돌리고 동시에 돌리지 않는다.
 */
export function coalesce(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;

  return function request() {
    if (running) {
      again = true;
      return running;
    }

    running = (async () => {
      try {
        do {
          again = false;
          await task();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}
