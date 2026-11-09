/**
 * City economy — the weekly bridge between the city-builder plan and the
 * campaign treasury.
 *
 * The city plan (`src/cityBuilder.ts`) knows how many residents and jobs the
 * town has; this module turns that into money once per week: municipal taxes
 * from residents holding jobs, a small park subsidy, utility upkeep for every
 * finished building, a social cost for residents nobody employs, and — when the
 * town is healthy enough — new plots breaking ground.
 *
 * Everything is pure and deterministic (randomness is injected), so the weekly
 * cycle is testable without React, the DOM or localStorage.
 */

import {
  BLOCK_STYLES,
  cityStats,
  placeBuilding,
  type BuildingKind,
  type CityState,
} from './cityBuilder';
import { restoreCityPlan, serializeCityPlan, type CityPlanSave } from './cityPlanState';

/** 0.7.0: weekly result of one started construction. */
export interface CityConstruction {
  kind: BuildingKind;
  lot: number;
  /** Week construction was started. */
  startedWeek: number;
  /** Weeks remaining until finished (0 = already finished). */
  weeksRemaining: number;
  /** Deposit paid to start. */
  deposit: number;
}

/** 0.7.0: result of one week's construction progress. */
export interface CityConstructionResult {
  /** Constructions that finished this week. */
  finished: CityConstruction[];
  /** Total weekly upkeep charged for unfinished constructions. */
  constructionUpkeep: number;
  /** Log lines about construction this week. */
  log: string[];
}

/** 0.7.0: one light city event that fired this week. */
export interface CityEvent {
  id: string;
  label: string;
  reason: string;
  fundsDelta: number;
}

export interface CityEconomyBalance {
  /** Weekly municipal tax per employed resident. */
  taxPerResident: number;
  /** Weekly municipal tax per filled working job. */
  taxPerJob: number;
  /** Fixed weekly subsidy for every finished park. */
  parkSubsidy: number;
  /** Weekly street/utility upkeep for every finished building. */
  upkeepPerBuilding: number;
  /** Weekly social cost for every resident who has no job in town. */
  unemploymentCostPerResident: number;
  /** Share of jobs that must be filled before the town starts growing (0..1). */
  growthMinOccupancy: number;
  /** Share of the weekly surplus set aside to fund new construction. */
  growthBudgetShare: number;
  /** Maximum number of new constructions started in one week. */
  maxGrowthStarts: number;
  /** 0.7.0: weekly upkeep per finished building by kind. */
  upkeepPerKind: Partial<Record<BuildingKind, number>>;
  /** 0.7.0: weekly fee collected per finished building by kind. */
  feePerKind: Partial<Record<BuildingKind, number>>;
  /** 0.7.0: deposit required to start construction of each kind. */
  constructionCostPerKind: Partial<Record<BuildingKind, number>>;
  /** 0.7.0: chance (0..1) of a light city event each week. */
  eventChance: number;
}

export const CITY_ECONOMY_BALANCE: CityEconomyBalance = {
  taxPerResident: 3,
  taxPerJob: 5,
  parkSubsidy: 95,
  upkeepPerBuilding: 18,
  unemploymentCostPerResident: 1.6,
  growthMinOccupancy: 0.6,
  growthBudgetShare: 0.5,
  maxGrowthStarts: 2,
  // 0.7.0: kind-specific upkeep and fees.
  upkeepPerKind: {
    house: 10,
    shop: 20,
    office: 30,
    factory: 45,
    park: 5,
  },
  feePerKind: {
    house: 4,
    shop: 8,
    office: 15,
    factory: 25,
    park: 0,
  },
  constructionCostPerKind: {
    house: 120,
    shop: 180,
    office: 260,
    factory: 400,
    park: 90,
  },
  eventChance: 0.15,
};

/** Money the town pays to break ground on each kind, funded from the surplus. */
export const GROWTH_DEPOSIT: Record<BuildingKind, number> = {
  house: 120,
  shop: 180,
  office: 260,
  factory: 400,
  park: 90,
};

/** Kinds the town builds on its own; the factory is left to the player. */
const GROWTH_PREFERENCE: BuildingKind[] = ['house', 'house', 'shop', 'park', 'office'];

/** 0.7.0: light city events that can fire each week. */
const CITY_EVENTS: CityEvent[] = [
  {
    id: 'city_festival',
    label: 'Городской праздник',
    reason: 'Приток посетителей и торговцы Plaza',
    fundsDelta: 150,
  },
  {
    id: 'city_storm',
    label: 'Шторм',
    reason: 'Повреждение кровли и остановка работ',
    fundsDelta: -80,
  },
  {
    id: 'city_riot',
    label: 'Бунт на рынке',
    reason: 'Ущерб торговым павильонам и пропуск выручки',
    fundsDelta: -200,
  },
  {
    id: 'city_investor',
    label: 'Инвестор в городе',
    reason: 'Частный капитал вливается в муниципальный бюджет',
    fundsDelta: 300,
  },
  {
    id: 'city_epidemic',
    label: 'Эпидемия',
    reason: 'Карантин, снижение выручки и расходы на лечение',
    fundsDelta: -120,
  },
];

export interface CityEconomyReport {
  week: number;
  residents: number;
  jobs: number;
  filledJobs: number;
  /** 0..1 share of the town's jobs that are filled by residents. */
  occupancy: number;
  /** Finished buildings only; unfinished ones pay and earn nothing. */
  built: number;
  parks: number;
  /** Residents with no job in town. */
  unemployed: number;
  income: {
    /** Tax paid on employment: residents holding jobs and the jobs they fill. */
    employmentTax: number;
    parks: number;
    /** 0.7.0: per-building fees collected from finished buildings. */
    fees: number;
  };
  expenses: {
    upkeep: number;
    unemployment: number;
    /** 0.7.0: weekly upkeep charged for unfinished constructions. */
    construction: number;
  };
  /** income - expenses (before construction costs). */
  surplus: number;
  /** Kinds of buildings started this week (empty when the town stagnated). */
  started: BuildingKind[];
  /** Money spent on the started constructions. */
  constructionSpend: number;
  /** 0.7.0: human-readable lines for the campaign log. */
  log: string[];
  /** 0.7.0: city events that fired this week. */
  events: CityEvent[];
  /** 0.7.0: previous week's report for comparison, if available. */
  previousWeek: CityEconomyReport | null;
}

export interface CityEconomyInput {
  plan: CityPlanSave | null | undefined;
  week: number;
  now?: number;
  random?: () => number;
  balance?: Partial<CityEconomyBalance>;
  /** 0.7.0: previous week's report for comparison. */
  previousReport?: CityEconomyReport | null;
}

export interface CityEconomyResult {
  report: CityEconomyReport;
  /** Plan to persist; null when there is no city to keep. */
  plan: CityPlanSave | null;
  /** 0.7.0: net change to campaign treasury this week (surplus minus construction/upkeep). */
  treasuryDelta: number;
}

/** Display names for buildings the weekly report may have started. */
export const KIND_LABELS: Record<BuildingKind, string> = {
  house: BLOCK_STYLES.house.label,
  shop: BLOCK_STYLES.shop.label,
  office: BLOCK_STYLES.office.label,
  factory: BLOCK_STYLES.factory.label,
  park: BLOCK_STYLES.park.label,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function emptyReport(week: number): CityEconomyReport {
  return {
    week,
    residents: 0,
    jobs: 0,
    filledJobs: 0,
    occupancy: 0,
    built: 0,
    parks: 0,
    unemployed: 0,
    income: { employmentTax: 0, parks: 0, fees: 0 },
    expenses: { upkeep: 0, unemployment: 0, construction: 0 },
    surplus: 0,
    started: [],
    constructionSpend: 0,
    log: [],
    events: [],
    previousWeek: null,
  };
}

/** Finished buildings grouped by kind, counted once per building. */
function countFinished(city: CityState): Record<BuildingKind, number> {
  const counts: Record<BuildingKind, number> = { house: 0, shop: 0, office: 0, factory: 0, park: 0 };
  const seen = new Set<number>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y][x];
      if (cell.type !== 'lot' || !cell.building) continue;
      const building = cell.building;
      if (building.progress < 1 || seen.has(building.id)) continue;
      seen.add(building.id);
      counts[building.kind] += 1;
    }
  }
  return counts;
}

function firstEmptyLot(city: CityState): { x: number; y: number } | null {
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y][x];
      if (cell.type === 'lot' && !cell.building) return { x, y };
    }
  }
  return null;
}

/** 0.7.0: pick one light city event by chance. */
function rollCityEvent(random: () => number): CityEvent | null {
  const roll = random();
  if (roll > CITY_ECONOMY_BALANCE.eventChance) return null;
  const idx = Math.floor(roll * CITY_EVENTS.length);
  return CITY_EVENTS[idx] ?? null;
}

/**
 * 0.7.0: applies one week of construction progress to unfinished buildings,
 * charging weekly upkeep for each unfinished one.
 */
function advanceConstructions(city: CityState): CityConstructionResult {
  const finished: CityConstruction[] = [];
  let constructionUpkeep = 0;
  const log: string[] = [];

  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y][x];
      if (cell.type !== 'lot' || !cell.building) continue;
      const building = cell.building;
      if (building.progress >= 1) continue;

      constructionUpkeep += Math.ceil(CITY_ECONOMY_BALANCE.upkeepPerBuilding * 0.25);
      building.progress = Math.min(1, building.progress + 1 / 7);
      if (building.progress >= 1) {
        finished.push({
          kind: building.kind,
          lot: cell.lot,
          startedWeek: 0,
          weeksRemaining: 0,
          deposit: 0,
        });
        log.push(`Строительство завершено: ${KIND_LABELS[building.kind]} на участке ${cell.lot}.`);
      }
    }
  }

  return { finished, constructionUpkeep, log };
}

/**
 * Starts up to `maxStarts` constructions, spending at most `budget`. Only the
 * starting deposit is charged here (construction itself is free in the
 * builder). A draw that does not fit the remaining budget is dropped, so a poor
 * week builds a house instead of a factory it cannot afford.
 */
function grow(
  city: CityState,
  budget: number,
  maxStarts: number,
  random: () => number,
): { kinds: BuildingKind[]; spend: number } {
  const kinds: BuildingKind[] = [];
  let spend = 0;
  for (let i = 0; i < maxStarts; i++) {
    const lot = firstEmptyLot(city);
    if (!lot) break;
    const kind = GROWTH_PREFERENCE[Math.floor(random() * GROWTH_PREFERENCE.length)] ?? GROWTH_PREFERENCE[0];
    const deposit = balanceConstructionCost(kind);
    if (spend + deposit > budget) continue;
    const result = placeBuilding(city, lot.x, lot.y, kind);
    if (!result.ok) continue;
    spend += deposit;
    kinds.push(kind);
  }
  return { kinds, spend };
}

/** 0.7.0: construction deposit for a kind, falling back to GROWTH_DEPOSIT. */
function balanceConstructionCost(kind: BuildingKind): number {
  return CITY_ECONOMY_BALANCE.constructionCostPerKind?.[kind] ?? GROWTH_DEPOSIT[kind];
}

/** 0.7.0: weekly upkeep for a finished building by kind. */
function balanceUpkeep(kind: BuildingKind): number {
  return CITY_ECONOMY_BALANCE.upkeepPerKind?.[kind] ?? CITY_ECONOMY_BALANCE.upkeepPerBuilding;
}

/** 0.7.0: weekly fee collected for a finished building by kind. */
function balanceFee(kind: BuildingKind): number {
  return CITY_ECONOMY_BALANCE.feePerKind?.[kind] ?? 0;
}

/**
 * Applies one week of city economy to a saved city plan.
 *
 * The plan goes through `restoreCityPlan`, so the same normalisation and capped
 * offline catch-up used by the builder view applies here; the returned plan is
 * re-serialised with fresh checkpoint metadata, so the offline interval is not
 * replayed twice.
 */
export function advanceCityEconomy(input: CityEconomyInput): CityEconomyResult {
  const balance: CityEconomyBalance = { ...CITY_ECONOMY_BALANCE, ...(input.balance ?? {}) };
  const week = Number.isFinite(input.week) ? Math.max(1, Math.floor(input.week)) : 1;
  const now = input.now ?? Date.now();
  const random = input.random ?? Math.random;

  if (!input.plan || !Array.isArray(input.plan.buildings) || input.plan.buildings.length === 0) {
    const report = emptyReport(week);
    report.previousWeek = input.previousReport ?? null;
    return { report, plan: input.plan ?? null, treasuryDelta: 0 };
  }

  const restored = restoreCityPlan(input.plan, input.plan.seed, now);
  const city = restored.city;
  const stats = cityStats(city);
  const report = emptyReport(week);
  report.residents = stats.population;
  report.jobs = stats.jobs;
  report.built = stats.built;
  report.previousWeek = input.previousReport ?? null;

  if (stats.built === 0) {
    report.log.push('Город: стройка идёт, но ни одно здание ещё не сдано — муниципальных доходов нет.');
    const construction = advanceConstructions(city);
    report.expenses.construction = construction.constructionUpkeep;
    report.log.push(...construction.log);
    const treasuryDelta = -report.expenses.construction;
    return { report, plan: restored.save ?? input.plan, treasuryDelta };
  }

  const counts = countFinished(city);
  report.parks = counts.park;

  // Residents can only take the jobs the town actually offers; the rest stay
  // unemployed even if the wider syndicate would happily hire them.
  const filledJobs = Math.min(stats.jobs, stats.population);
  const occupancy = stats.jobs > 0 ? clamp01(filledJobs / stats.jobs) : 0;
  report.filledJobs = filledJobs;
  report.occupancy = occupancy;
  report.unemployed = Math.max(0, stats.population - filledJobs);

  // A run-down city still collects taxes, but less of them.
  const conditionFactor = 0.6 + 0.4 * clamp01(stats.condition);
  const employmentTax = Math.round(filledJobs * (balance.taxPerResident + balance.taxPerJob) * conditionFactor);
  const parkIncome = Math.round(counts.park * balance.parkSubsidy);
  const upkeep = Object.entries(counts).reduce((sum, [kind, count]) => {
    return sum + count * balanceUpkeep(kind as BuildingKind);
  }, 0);
  const fees = Object.entries(counts).reduce((sum, [kind, count]) => {
    return sum + count * balanceFee(kind as BuildingKind);
  }, 0);
  const unemployment = Math.round(report.unemployed * balance.unemploymentCostPerResident);

  report.income.employmentTax = employmentTax;
  report.income.parks = parkIncome;
  report.income.fees = fees;
  report.expenses.upkeep = upkeep;
  report.expenses.unemployment = unemployment;

  // 0.7.0: roll a light city event.
  const event = rollCityEvent(random);
  if (event) {
    report.events.push(event);
    report.log.push(
      `Событие в городе: ${event.label} — ${event.reason} (${event.fundsDelta > 0 ? '+' : ''}${event.fundsDelta} AX).`
    );
  }

  const baseSurplus = employmentTax + parkIncome + fees - upkeep - unemployment + (event?.fundsDelta ?? 0);
  report.surplus = baseSurplus;

  report.log.push(
    `Город: ${stats.built} зданий, ${stats.population} жителей, ${filledJobs}/${stats.jobs} рабочих мест `
    + `(${Math.round(occupancy * 100)}%).`
  );
  if (employmentTax + parkIncome + fees > 0) {
    report.log.push(`Город принёс ${employmentTax + parkIncome + fees} AX муниципального дохода.`);
  }
  if (upkeep + unemployment > 0) {
    report.log.push(`Город израсходовал ${upkeep + unemployment} AX: обслуживание и пособия безработным.`);
  }

  // 0.7.0: automatic growth from surplus, plus construction upkeep.
  let nextPlan = restored.save;
  let constructionSpend = 0;
  let constructionUpkeep = 0;

  const construction = advanceConstructions(city);
  constructionUpkeep = construction.constructionUpkeep;
  report.expenses.construction = constructionUpkeep;
  report.log.push(...construction.log);

  const netSurplus = baseSurplus - constructionUpkeep;

  if (netSurplus > 0 && occupancy >= balance.growthMinOccupancy) {
    const budget = Math.floor(netSurplus * balance.growthBudgetShare);
    const started = grow(city, budget, balance.maxGrowthStarts, random);
    report.started = started.kinds;
    constructionSpend = started.spend;
    if (started.kinds.length > 0) {
      report.log.push(
        `Город заложил стройку: ${started.kinds.map(kind => KIND_LABELS[kind]).join(', ')} `
        + `(-${started.spend} AX).`
      );
      nextPlan = serializeCityPlan(city, input.plan.seed, {
        savedAt: now,
        wasOpenAtSave: input.plan.wasOpenAtSave,
      });
    }
  } else if (netSurplus <= 0) {
    report.log.push('Город не может начать новую стройку: неделя ушла в минус.');
  } else {
    report.log.push('Город замер: слишком мало жителей заняты на местных работах.');
  }

  report.constructionSpend = constructionSpend;
  const treasuryDelta = netSurplus - constructionSpend;

  return { report, plan: nextPlan, treasuryDelta };
}

/** 0.7.0: compares two reports and returns the delta for each line item. */
export function compareCityReports(
  current: CityEconomyReport,
  previous: CityEconomyReport | null,
): {
  incomeDelta: number;
  expensesDelta: number;
  surplusDelta: number;
  residentsDelta: number;
  jobsDelta: number;
  builtDelta: number;
  trend: 'up' | 'down' | 'flat';
} {
  if (!previous) {
    return { incomeDelta: 0, expensesDelta: 0, surplusDelta: 0, residentsDelta: 0, jobsDelta: 0, builtDelta: 0, trend: 'flat' };
  }
  const prev = previous;
  const incomeDelta = (current.income.employmentTax + current.income.parks + current.income.fees)
    - (prev.income.employmentTax + prev.income.parks + prev.income.fees);
  const expensesDelta = (current.expenses.upkeep + current.expenses.unemployment + current.expenses.construction)
    - (prev.expenses.upkeep + prev.expenses.unemployment + prev.expenses.construction);
  const surplusDelta = current.surplus - prev.surplus;
  const residentsDelta = current.residents - prev.residents;
  const jobsDelta = current.jobs - prev.jobs;
  const builtDelta = current.built - prev.built;
  const trend = surplusDelta > 0 ? 'up' : surplusDelta < 0 ? 'down' : 'flat';
  return { incomeDelta, expensesDelta, surplusDelta, residentsDelta, jobsDelta, builtDelta, trend };
}
