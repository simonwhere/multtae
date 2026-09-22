/**
 * rescheduleAll (SPEC.md 12.3): 앞으로 14일치 알림을 다시 예약한다.
 * 알림을 실제로 다루는 쪽은 Notifier 로 받아서, 규칙은 Node 에서 가짜 Notifier 로 테스트한다.
 *
 * 기존 예약을 전부 취소하고 시작하지 않는다. iOS 의 전체 취소는 비동기라 바로 뒤에 넣은 예약까지 지울 수 있고,
 * 그러면 가장 가까운 알림이 빠진다. 대신 계획에 없는 id 만 지우고 나머지는 같은 id 로 덮어쓴다. 결과는 같다.
 */
import { latestEventAt } from '../db/events';
import { listPlantsWithSpace, updatePlant } from '../db/plants';
import type { PlantWithSpace } from '../db/plants';
import type { SpeciesCacheRow } from '../db/schema';
import { getCachedSpecies } from '../db/species-cache';
import { listPlantTasks } from '../db/tasks';
import { getSetting, setSetting } from '../db/settings';
import type { Database } from '../db/types';
import { recordWatering } from '../db/watering';
import { addDays, getSeason, getSeasonAt, toCalendarDate } from '../engine';
import type { CalendarDate, Coefficients } from '../engine';
import { ko } from '../i18n/ko';
import { parseJsonObject } from '../lib/validate';
import { fertilizerRule, isFertilizerDue, repotHint } from '../plants/feeding';
import { planReschedule } from '../plants/schedule';
import { dateKey } from '../weather/forecast';
import { loadUsableWeather } from '../weather/refresh';
import { heatDays, planRainWatering, rainWatered, weatherAlert } from '../weather/rules';
import { forecast } from './forecast';
import { planNotifications, SCHEDULE_DAYS, weatherAlertTime } from './plan';
import type { PlannedNotification, PlanRepot, PlanWeatherAlert } from './plan';
import { parseNotificationSettings } from './settings';
import type { NotificationSettings } from './settings';

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

  const items = await listPlantsWithSpace(db);
  let updatedPlants = 0;

  // 0. 비가 넉넉히 오는 날에는 테라스 식물 물주기를 비가 대신한다 (7.2). 기록 id 를 식물·날짜로
  //    정해 두어 하루에 몇 번 불려도 한 번만 남는다
  const weather = await loadUsableWeather(db, now, utcOffsetMinutes);
  for (const item of rainWatered(items, weather, clock)) {
    const plan = planRainWatering(item.plant, item.space, {
      ...context,
      now,
      logId: `rain-${item.plant.id}-${dateKey(context.today)}`,
    });
    await recordWatering(db, item.plant.id, plan.plantPatch, plan.log);
    item.plant = { ...item.plant, ...plan.plantPatch };
    updatedPlants += 1;
  }

  // 1. 계절·계수·공간이 바뀌었으면 다음 물주기를 다시 센다 (시나리오 C). 알림 권한과 무관하다
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

  // 비료는 물 줄 날에 함께, 분갈이는 적기 월 1일에 (8.2, 8.3)
  const feeding = await loadFeeding(db, items, utcOffsetMinutes);
  const ahead = forecast(items, clock);
  const plants = ahead.plants.map((planned, index) => {
    const item = items[index]!;
    const info = feeding.get(item.plant.id)!;
    return {
      ...planned,
      fertilize: isFertilizerDue(
        fertilizerRule(item.plant, info.species),
        { lastFertilized: info.lastFertilized, lastRepot: info.lastRepot },
        planned.waterDate,
        getSeason(planned.waterDate, coefficients.seasonBounds),
      ),
    };
  });

  const scheduled = planNotifications({
    ...ahead,
    plants,
    tasks,
    repots: repotsAhead(items, feeding, context.today),
    now,
    utcOffsetMinutes,
    settings,
    heatDays: heatDays(items, weather),
    weatherAlert: await alertFor(db, items, weather, { ...clock, season: context.season, settings }),
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

interface Feeding {
  species: SpeciesCacheRow | null;
  lastFertilized: CalendarDate | null;
  lastRepot: CalendarDate | null;
  /** 분갈이를 센 기준일. 마지막 분갈이를 모르면 등록일 */
  since: CalendarDate;
}

/** 식물마다 종 DB 의 비료·분갈이 규칙과 마지막 비료·분갈이 날 */
async function loadFeeding(
  db: Database,
  items: readonly PlantWithSpace[],
  utcOffsetMinutes: number,
): Promise<Map<string, Feeding>> {
  const feeding = new Map<string, Feeding>();
  for (const { plant } of items) {
    const [species, fertilizedAt] = await Promise.all([
      plant.scientificName ? getCachedSpecies(db, plant.scientificName) : Promise.resolve(null),
      latestEventAt(db, plant.id, 'fertilize'),
    ]);
    const lastRepot = plant.lastRepotAt === null ? null : toCalendarDate(plant.lastRepotAt, utcOffsetMinutes);
    const registered = toCalendarDate(plant.createdAt, utcOffsetMinutes);
    feeding.set(plant.id, {
      species,
      // 비료를 준 기록이 없으면 등록일부터 센다. 새로 들인 식물에 바로 비료를 권하지 않는다
      lastFertilized:
        fertilizedAt === null ? registered : toCalendarDate(fertilizedAt, utcOffsetMinutes),
      lastRepot,
      since: lastRepot ?? registered,
    });
  }
  return feeding;
}

/** 14일 안에 오는 1일마다 분갈이를 검토할 식물 (8.3) */
function repotsAhead(
  items: readonly PlantWithSpace[],
  feeding: ReadonlyMap<string, Feeding>,
  today: CalendarDate,
): PlanRepot[] {
  const repots: PlanRepot[] = [];
  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    if (day.day !== 1) continue;

    for (const { plant } of items) {
      const info = feeding.get(plant.id)!;
      const hint = repotHint(
        plant,
        info.species,
        { since: info.since, known: info.lastRepot !== null, recent: [] },
        day,
      );
      if (hint?.reason === 'interval') {
        repots.push({ nickname: plant.nickname, months: hint.months, known: hint.known, date: day });
      }
    }
  }
  return repots;
}

/** 한파·서리 예보 알림 (12.1). 같은 새벽은 처음 정한 시각에 한 번만 울린다 */
async function alertFor(
  db: Database,
  items: Parameters<typeof weatherAlert>[0],
  weather: Parameters<typeof weatherAlert>[1],
  context: RescheduleClock & { season: ReturnType<typeof getSeasonAt>; settings: NotificationSettings },
): Promise<PlanWeatherAlert | null> {
  const alert = weatherAlert(items, weather, context);
  if (!alert) return null;

  const raw = parseJsonObject(await getSetting(db, 'weather_alert'));
  const stored =
    typeof raw?.targetDate === 'string' && typeof raw.fireAt === 'number'
      ? { targetDate: raw.targetDate, fireAt: raw.fireAt }
      : null;
  const fireAt = weatherAlertTime(alert.targetDate, stored, context);
  if (stored?.targetDate !== alert.targetDate) {
    await setSetting(db, 'weather_alert', JSON.stringify({ targetDate: alert.targetDate, fireAt }));
  }

  return {
    targetDate: alert.targetDate,
    fireAt,
    title: ko.notifications.weatherTitle[alert.kind],
    body: ko.notifications.weatherBody(alert.low, alert.count),
  };
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
