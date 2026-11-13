/**
 * Дневной календарь кампании.
 *
 * Кампания по-прежнему идёт неделями (борда «Следующая неделя» = семь шагов),
 * но игрок проходит её днями. Каждый день недели — это «страница» календаря.
 *
 * Дата кампании привязана к номеру недели и всегда стартует 1 января 1845 года
 * (см. {@link CALENDAR_START_YEAR}), так что неделя 1 — это 1–7 января 1845.
 *
 * {@link buildDaySchedule} читает сохранение кампании и раскладывает всё, что в
 * ней запланировано, по дням текущей недели: караваны, захваты, VIP-контракты,
 * закупки пленных, поставки из регионов, больничные койки, зону отдыха,
 * процедуры салона, ремонты зданий и контракты сотрудников. Эти события
 * читаются из тех же полей, по которым идёт недельный цикл
 * (`campaignWeek.ts`), поэтому расписание не расходится с расчётом недели.
 */

import type { GameTabId } from "./dayCalendarTabs";
import type { ManagedCampaignState } from "./saveState";
import type { BuildingId, Employee } from './expansionTypes';
import { getBuildingDefinition } from './buildingsEngine';

/** Кампания всегда начинается 1 января 1845 года. */
export const CALENDAR_START_YEAR = 1845;
/** Дней в кампании до начала игры: неделя 1 начинается ровно в эту дату. */
export const DAYS_PER_WEEK = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WEEKDAY_LONG = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
];
export const MONTH_NAMES = MONTHS_GENITIVE;
export const MONTH_NAMES_SHORT = MONTHS_SHORT;

/** Календарная дата кампании. `dayIndex` — номер дня от 1 января 1845 (0-based). */
export interface CampaignDate {
  year: number;
  /** 0-based месяц, как в `Date`. */
  month: number;
  /** День месяца, 1–31. */
  day: number;
  /** День недели, 0 — понедельник … 6 — воскресенье. */
  weekday: number;
  /** Номер дня кампании (0-based). */
  dayIndex: number;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** Номер недели, которая идёт первой в новой кампании. */
export const FIRST_WEEK = 12;

/**
 * Номер недели, в которую попал переданный день. Неделя 1 начинается в день 0,
 * поэтому день 0..6 — неделя 1, день 7..13 — неделя 2 и так далее.
 */
export function campaignWeekForDay(dayIndex: number): number {
  return Math.floor(Math.max(0, Math.floor(dayIndex)) / DAYS_PER_WEEK) + 1;
}

/** Номер дня (0-based) внутри недели: 0 — понедельник. */
export function dayOfWeek(dayIndex: number): number {
  const normalized = Math.max(0, Math.floor(dayIndex));
  return ((normalized % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** Первый день (0-based) указанной недели кампании. */
export function firstDayIndexOfWeek(week: number): number {
  return (Math.max(1, Math.floor(week)) - 1) * DAYS_PER_WEEK;
}

/**
 * Дата кампании по номеру дня. Кампания начинается 1 января 1845 года и идёт
 * по григорианскому календарю.
 */
export function campaignDateForDay(dayIndex: number): CampaignDate {
  const normalized = Math.max(0, Math.floor(dayIndex));
  const base = new Date(Date.UTC(CALENDAR_START_YEAR, 0, 1));
  const date = new Date(base.getTime() + normalized * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    // В JS 0 — воскресенье; в календаре неделя начинается с понедельника.
    weekday: (date.getUTCDay() + 6) % 7,
    dayIndex: normalized,
  };
}

/** День кампании по дате. Для дат до 1845 года вернёт 0. */
export function dayIndexForDate(
  year: number,
  month: number,
  day: number,
): number {
  const base = Date.UTC(CALENDAR_START_YEAR, 0, 1);
  const target = Date.UTC(year, month, day);
  return Math.max(0, Math.round((target - base) / MS_PER_DAY));
}

/** Номер недели по дате. */
export function campaignWeekForDate(
  year: number,
  month: number,
  day: number,
): number {
  return campaignWeekForDay(dayIndexForDate(year, month, day));
}

/** «1 января 1845». */
export function formatCampaignDate(date: CampaignDate): string {
  return `${date.day} ${MONTHS_GENITIVE[date.month]} ${date.year}`;
}

/** «1845-01-01» — для ключей и атрибутов `date`. */
export function formatIsoDate(date: CampaignDate): string {
  return `${date.year}-${pad2(date.month + 1)}-${pad2(date.day)}`;
}

/** «01.01.1845». */
export function formatShortDate(date: CampaignDate): string {
  return `${pad2(date.day)}.${pad2(date.month + 1)}.${date.year}`;
}

/** «Пн, 1 января» — подпись дня в ленте недели. */
export function formatDayHeading(date: CampaignDate): string {
  return `${WEEKDAY_SHORT[date.weekday]}, ${date.day} ${MONTHS_GENITIVE[date.month]}`;
}

/** «янв 1845» — подпись месяца в календаре. */
export function formatMonthHeading(year: number, month: number): string {
  return `${MONTHS_SHORT[month]} ${year}`;
}

/** Раскладка месяца для сетки календаря: неделя начинается с понедельника. */
export function monthGrid(
  year: number,
  month: number,
): (CampaignDate | null)[] {
  const firstOfMonth = Date.UTC(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = (new Date(firstOfMonth).getUTCDay() + 6) % 7;
  const cells: (CampaignDate | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(campaignDateForDay(dayIndexForDate(year, month, day)));
  }
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null);
  return cells;
}

/**
 * Индекс дня внутри недели. Неделя стартует в понедельник: `daysRemaining`
 * считается от конца недели (воскресенья), поэтому событие, у которого
 * осталось `n` недель, приходится на воскресенье недели `week + n`.
 */
function dayIndexInWeek(daysBeforeEnd: number): number {
  // 0 — воскресенье, 6 — понедельник; остальные события разносим по будням.
  return Math.max(
    0,
    Math.min(DAYS_PER_WEEK - 1, DAYS_PER_WEEK - 1 - daysBeforeEnd),
  );
}

/** События, которые попадают на день кампании. */
export type DayEventKind =
  | "arrival"
  | "departure"
  | "raid"
  | "contract"
  | "supply"
  | "hospital"
  | "rest"
  | "salon"
  | "building"
  | "wages"
  | "report"
  | "deadline";

export interface DayEvent {
  id: string;
  /** День кампании (0-based), в который событие происходит. */
  dayIndex: number;
  kind: DayEventKind;
  /** Вкладка, в которой ведётся это направление. */
  tab: GameTabId;
  title: string;
  detail?: string;
  tone: "info" | "success" | "warning" | "danger";
}

/** Один день недели со всеми событиями. */
export interface CalendarDay {
  dayIndex: number;
  date: CampaignDate;
  events: DayEvent[];
}

export interface DaySchedule {
  /** Неделя, к которой относится расписание. */
  week: number;
  days: CalendarDay[];
  /** События, вынесенные за пределы текущей недели (открытые в понедельник). */
  openEvents: DayEvent[];
}

interface ScheduleOptions {
  /** Неделя, которую раскладываем. По умолчанию — неделя сохранения. */
  week?: number;
  /** Сколько недель вперёд искать события. */
  horizonWeeks?: number;
}

const clampWeekRemaining = (value: number, floor = 0) =>
  Math.max(floor, Math.floor(Number(value) || 0));

/**
 * Раскладывает всё, что запланировано в кампании, по дням недели `week`.
 *
 * Логика раскладки:
 *  - события со сроком «сейчас» (срок истёк) — на понедельник;
 *  - события, у которых осталось `n` недель, — на воскресенье недели `week + n - 1`;
 *  - ремонты зданий идут по дням с сроком внутри недели.
 */
export function buildDaySchedule(
  state: ManagedCampaignState,
  options: ScheduleOptions = {},
): DaySchedule {
  const week = Math.max(1, Math.floor(options.week ?? state.week ?? 1));
  const horizonWeeks = Math.max(0, Math.floor(options.horizonWeeks ?? 8));
  const weekStart = firstDayIndexOfWeek(week);
  const weekEnd = weekStart + DAYS_PER_WEEK - 1;
  const events: DayEvent[] = [];
  const openEvents: DayEvent[] = [];

  const currentWeek = Math.max(1, Math.floor(state.week ?? 1));
  /** Номер дня для события, у которого осталось `weeksRemaining` недель. */
  const dayForRemaining = (
    weeksRemaining: number,
    offsetInWeek = 0,
  ): number | null => {
    const dueWeek = currentWeek + clampWeekRemaining(weeksRemaining) - 1;
    if (dueWeek < week) return null;
    if (dueWeek > week + horizonWeeks) return null;
    const base = firstDayIndexOfWeek(dueWeek) + dayIndexInWeek(offsetInWeek);
    if (dueWeek === week) {
      // События наступившей недели раскладываем от понедельника.
      return Math.min(
        weekEnd,
        firstDayIndexOfWeek(dueWeek) +
          dayIndexInWeek(Math.min(DAYS_PER_WEEK - 1, offsetInWeek)),
      );
    }
    return base;
  };

  const push = (event: Omit<DayEvent, "dayIndex">, dayIndex: number | null) => {
    if (dayIndex === null) {
      if (!openEvents.some((candidate) => candidate.id === event.id))
        openEvents.push({ ...event, dayIndex: weekEnd });
      return;
    }
    if (events.some((candidate) => candidate.id === event.id)) return;
    events.push({ ...event, dayIndex });
  };

  /** Событие, которое случится в понедельник наступившей недели (стык недель). */
  const immediateDay = weekStart;

  // --- Караваны: прибытие и отбытие ---------------------------------------
  state.caravans.forEach((caravan, index) => {
    if (caravan.status !== "traveling") {
      if (caravan.status === "lost" || caravan.status === "raided") {
        push(
          {
            id: `caravan:${caravan.id}:loss`,
            kind: "raid",
            tab: "caravans",
            tone: "danger",
            title: `Караван «${caravan.name}» потерян`,
            detail: `Направление: ${caravan.destRegion} · инвестиции ${caravan.investment}`,
          },
          immediateDay,
        );
      }
      return;
    }
    const remaining = clampWeekRemaining(caravan.weeksRemaining);
    if (remaining <= 1) {
      push(
        {
          id: `caravan:${caravan.id}:arrival`,
          kind: "arrival",
          tab: "caravans",
          tone: "success",
          title: `Прибытие каравана «${caravan.name}»`,
          detail: `Из ${caravan.originRegion} в ${caravan.destRegion} · глава ${caravan.leaderName}`,
        },
        weekEnd,
      );
    } else {
      push(
        {
          id: `caravan:${caravan.id}:progress`,
          kind: "departure",
          tab: "caravans",
          tone: "info",
          title: `Караван «${caravan.name}» в пути`,
          detail: `До ${caravan.destRegion} — ${remaining} нед.`,
        },
        dayForRemaining(remaining, index % 3),
      );
    }
  });

  // --- Захваты: отряд на маршруте ------------------------------------------
  (state.captureOperations || []).forEach((operation, index) => {
    if (operation.status !== "outbound") return;
    const remaining = clampWeekRemaining(operation.weeksRemaining);
    if (remaining <= 0) {
      push(
        {
          id: `capture:${operation.id}:snatch`,
          kind: "raid",
          tab: "capture_ops",
          tone: "warning",
          title: `Захват «${operation.codename}»: выход на цель`,
          detail: `${operation.targetName} · ${operation.targetRegionName} · шанс ${operation.captureChance}%`,
        },
        weekEnd,
      );
    } else {
      push(
        {
          id: `capture:${operation.id}:road`,
          kind: "departure",
          tab: "capture_ops",
          tone: "info",
          title: `Отряд «${operation.codename}» на маршруте`,
          detail: `Цель: ${operation.targetName} · осталось ${remaining} нед.`,
        },
        dayForRemaining(remaining, index % 3),
      );
    }
  });

  // --- VIP-контракты -------------------------------------------------------
  (state.contracts || []).forEach((contract, index) => {
    if (contract.status !== "active") return;
    const remaining = clampWeekRemaining(contract.weeksRemaining);
    push(
      {
        id: `contract:${contract.id}`,
        kind: remaining <= 1 ? "deadline" : "contract",
        tab: "contracts",
        tone: remaining <= 1 ? "warning" : "info",
        title: `${remaining <= 1 ? "Сдача" : "Работа"} по «${contract.title}»`,
        detail: `${contract.clientName} · привлекательность от ${contract.requiredAttractiveness}`,
      },
      remaining <= 1 ? weekEnd : dayForRemaining(remaining, (index % 3) + 1),
    );
  });

  // --- Заказы на пленных ---------------------------------------------------
  (state.slaveContracts || []).forEach((contract, index) => {
    if (contract.status !== "active") return;
    const remaining = clampWeekRemaining(contract.weeksRemaining);
    const deadline =
      typeof contract.deadlineWeek === "number" ? contract.deadlineWeek : null;
    const isDeadline = deadline !== null ? deadline <= week : remaining <= 1;
    push(
      {
        id: `slaveContract:${contract.id}`,
        kind: isDeadline ? "deadline" : "supply",
        tab: "supply_contracts",
        tone: isDeadline ? "warning" : "info",
        title: `${isDeadline ? "Срок заказа" : "Заказ"}: ${contract.buyerName}`,
        detail: `${contract.quantityDelivered}/${contract.quantityWanted} чел. · ${contract.pricePerHead} за голову`,
      },
      isDeadline ? weekEnd : dayForRemaining(remaining, (index % 3) + 1),
    );
  });

  // --- Поставки из регионов ------------------------------------------------
  (state.tradeSupplyContracts || []).forEach((contract, index) => {
    if (contract.status !== "active") return;
    const remaining = clampWeekRemaining(contract.weeksRemaining);
    push(
      {
        id: `supply:${contract.id}`,
        kind: remaining <= 1 ? "deadline" : "supply",
        tab: "supply_contracts",
        tone: remaining <= 1 ? "warning" : "info",
        title: `Выкуп из ${contract.regionName}`,
        detail: `до ${contract.weeklyQuantity} чел./нед. · ${contract.pricePerHead} за голову · осталось ${remaining} нед.`,
      },
      remaining <= 1 ? weekEnd : dayForRemaining(remaining, index % 3),
    );
  });

  // --- Больница: выписки и роды -------------------------------------------
  (state.hospital?.patients || []).forEach((patient, index) => {
    const remaining = clampWeekRemaining(patient.weeksRemaining);
    const isDischarge = remaining <= 1;
    push(
      {
        id: `hospital:${patient.characterId}:${patient.admittedWeek}`,
        kind: "hospital",
        tab: "hospital",
        tone: isDischarge ? "success" : "info",
        title: isDischarge
          ? `Выписка: ${patient.characterName}`
          : `Палата: ${patient.characterName}`,
        detail:
          patient.admission === "birth"
            ? "Роды и восстановление"
            : patient.admission === "observation"
              ? "Наблюдение"
              : "Лечение",
      },
      isDischarge ? weekEnd : dayForRemaining(remaining, index % 2),
    );
  });

  // --- Зона отдыха ---------------------------------------------------------
  (state.restZone?.placements || []).forEach((placement, index) => {
    const remaining = clampWeekRemaining(placement.weeksRemaining);
    const isDone = remaining <= 1;
    push(
      {
        id: `rest:${placement.id}`,
        kind: "rest",
        tab: "rest_zone",
        tone: isDone ? "success" : "info",
        title: isDone
          ? `Возврат: ${placement.characterName}`
          : `Отдых: ${placement.characterName}`,
        detail: `${placement.programName} · осталось ${remaining} нед.`,
      },
      isDone ? weekEnd : dayForRemaining(remaining, index % 2),
    );
  });

  // --- Салон красоты -------------------------------------------------------
  (state.beautySalon?.scheduledTreatments || []).forEach((treatment, index) => {
    if (treatment.status !== "queued") return;
    const targetWeek = Math.max(1, Math.floor(treatment.nextRunWeek));
    const day =
      firstDayIndexOfWeek(targetWeek) + dayIndexInWeek((index + 2) % 5);
    push(
      {
        id: `salon:${treatment.id}`,
        kind: "salon",
        tab: "salon",
        tone: "info",
        title: `Салон: ${treatment.treatmentName}`,
        detail: `${treatment.characterName}${treatment.isAutomatic ? ` · каждые ${treatment.intervalWeeks} нед.` : ""}`,
      },
      day < weekStart
        ? weekStart
        : day > weekEnd + DAYS_PER_WEEK * horizonWeeks
          ? null
          : day,
    );
  });

  // --- Ремонты зданий ------------------------------------------------------
  (state.auxiliaryBuildings || []).forEach((building, index) => {
    const weeks = clampWeekRemaining(building.upgradeWeeksRemaining ?? 0);
    if (weeks <= 0) return;
    push(
      {
        id: `building:${building.id}`,
        kind: "building",
        tab: "buildings",
        tone: "info",
        title: `Работы в здании «${getBuildingDefinition(building.id as BuildingId)?.name ?? building.id}»`,
        detail: `Осталось ${weeks} нед. до уровня ${building.upgradeTargetLevel ?? "—"}`,
      },
      weeks <= 1 ? weekEnd - 1 : dayForRemaining(weeks, index % 4),
    );
  });

  // --- Контракты сотрудников ----------------------------------------------
  const expiringEmployees = (state.employees || []).filter(
    (employee): employee is Employee & { contractEndWeek: number } =>
      employee.status === "active" &&
      typeof employee.contractEndWeek === "number",
  );
  expiringEmployees.forEach((employee, index) => {
    const endWeek = employee.contractEndWeek;
    if (endWeek < week || endWeek > week + horizonWeeks) return;
    push(
      {
        id: `employee:${employee.id}:contract`,
        kind: "deadline",
        tab: "staff",
        tone: "warning",
        title: `Истекает контракт: ${employee.name}`,
        detail: `${employee.specialty} · мораль ${employee.morale}`,
      },
      firstDayIndexOfWeek(endWeek) + dayIndexInWeek((index + 1) % 5),
    );
  });

  // --- Касса и расчётный день ---------------------------------------------
  push(
    {
      id: "wages:weekly",
      kind: "wages",
      tab: "finances",
      tone: "info",
      title: "Расчётный день: зарплаты, содержание и кредит",
      detail: `Сотрудников: ${(state.employees || []).length}`,
    },
    weekEnd,
  );

  const report = state.lastWeeklyReport;
  if (report && report.week >= week) {
    push(
      {
        id: `report:${report.week}`,
        kind: "report",
        tab: "finances",
        tone: "info",
        title: `Финансовый отчёт за неделю ${report.week}`,
        detail: `Чистый доход ${report.netIncome} · касса ${report.treasuryAfter}`,
      },
      weekStart,
    );
  }

  const days: CalendarDay[] = [];
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const dayIndex = weekStart + i;
    days.push({
      dayIndex,
      date: campaignDateForDay(dayIndex),
      events: events.filter((event) => event.dayIndex === dayIndex),
    });
  }

  return { week, days, openEvents };
}

/** Все дни одной вкладки в пределах ленты недель. */
export function daysForTab(
  schedule: DaySchedule,
  tab: GameTabId,
): CalendarDay[] {
  return schedule.days
    .map((day) => ({
      ...day,
      events: day.events.filter((event) => event.tab === tab),
    }))
    .filter((day) => day.events.length > 0);
}
