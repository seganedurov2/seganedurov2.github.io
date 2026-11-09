/**
 * Рынок и спрос (0.6.5).
 *
 * Региональный спрос толкает цену пленника вверх, региональное влияние
 * («standing») даёт скидку и улучшает качество кандидатов. Покупки поднимают
 * спрос в регионе-источнике, неделя гасит спрос и влияние обратно к базе, а
 * разница между дешёвыми регионами-источниками и дорогими рынками сбыта даёт
 * игроку арбитражный цикл.
 *
 * Модуль чистый и React-free: все функции принимают числа/словари и отдают
 * новые словари, ничего не мутируя. Любое значение приходит из сейва, поэтому
 * все расчёты проходят через `safeNumber`/`safeAmount` — NaN не должен попасть
 * ни в цену, ни в недельный отчёт.
 */

/** Базовая региональная потребность (1.0 = нейтральный рынок). */
export const MARKET_DEMAND_BASE = 1;
/** Минимальный и максимальный региональный спрос. */
export const MARKET_DEMAND_MIN = 0.75;
export const MARKET_DEMAND_MAX = 2;
/** Насколько покупка в регионе поднимает спрос. */
export const MARKET_DEMAND_PER_PURCHASE = 0.05;
/** Недельное затухание спроса к базе. */
export const MARKET_DEMAND_DECAY = 0.02;

/** Региональное влияние по умолчанию (0..100). */
export const MARKET_STANDING_DEFAULT = 50;
/** Прирост влияния за покупку. */
export const MARKET_STANDING_PER_PURCHASE = 1;
/** Недельное затухание влияния. */
export const MARKET_STANDING_DECAY = 0.5;
/** Максимальная скидка от влияния (100 влияния = -20%). */
export const MARKET_STANDING_MAX_DISCOUNT = 0.2;

/** Спрос не выше этого — регион считается рынком-источником (дешёвая закупка). */
export const ARBITRAGE_SOURCE_DEMAND = 0.8;
/** Спрос не ниже этого — регион считается рынком сбыта (дорогая перепродажа). */
export const ARBITRAGE_TARGET_DEMAND = 1.2;
/** Порог маржи, при котором регион считается выгодным для перепродажи. */
export const ARBITRAGE_MIN_MARGIN_PCT = 0.15;

/** Число, которое гарантированно конечное. */
export function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Сумма, которая не станет NaN/Infinity и не уйдёт в минус. */
export function safeAmount(value: unknown): number {
  return Math.max(0, Math.floor(safeNumber(value, 0)));
}

export function clampDemand(value: unknown): number {
  return Math.min(
    MARKET_DEMAND_MAX,
    Math.max(MARKET_DEMAND_MIN, safeNumber(value, MARKET_DEMAND_BASE)),
  );
}

export function clampStanding(value: unknown): number {
  return Math.min(100, Math.max(0, safeNumber(value, MARKET_STANDING_DEFAULT)));
}

/** Итоговые суммы недели, посчитанные без NaN. */
export interface WeeklyTotals {
  revenue: number;
  expenses: number;
  net: number;
}

/**
 * Простая защита недельных итогов: каждый источник проверяется отдельно, а
 * итог не может стать NaN, Infinity или уйти в бесконечность при переполнении.
 */
export function computeWeeklyTotals(
  revenue: Record<string, unknown>,
  expenses: Record<string, unknown>,
): WeeklyTotals {
  let revenueSum = 0;
  for (const key of Object.keys(revenue))
    revenueSum += safeNumber(revenue[key], 0);
  let expenseSum = 0;
  for (const key of Object.keys(expenses))
    expenseSum += safeNumber(expenses[key], 0);
  const safeRevenue = Number.isFinite(revenueSum) ? Math.round(revenueSum) : 0;
  const safeExpenses = Number.isFinite(expenseSum) ? Math.round(expenseSum) : 0;
  return {
    revenue: safeRevenue,
    expenses: safeExpenses,
    net: safeRevenue - safeExpenses,
  };
}

/**
 * Итоговая цена покупки: базовая цена кандидата × региональный спрос ×
 * скидка за влияние. Все три числа защищены от NaN, цена не уходит в минус.
 */
export function calculateFinalMarketPrice(
  basePrice: number,
  demand: number,
  standing: number,
): number {
  const base = safeAmount(basePrice);
  const priceDemand = clampDemand(demand);
  const standingDiscount =
    1 - (clampStanding(standing) / 100) * MARKET_STANDING_MAX_DISCOUNT;
  return Math.max(0, Math.floor(base * priceDemand * standingDiscount));
}

export function marketDemandOf(
  demand: Record<string, number>,
  regionId: string,
): number {
  return clampDemand(demand?.[regionId] ?? MARKET_DEMAND_BASE);
}

export function marketStandingOf(
  standing: Record<string, number>,
  regionId: string,
): number {
  return clampStanding(standing?.[regionId] ?? MARKET_STANDING_DEFAULT);
}

/**
 * Покупка в регионе: спрос растёт на 0.05, влияние — на 1 пункт. Словари
 * возвращаются новыми, исходные не меняются.
 */
export function updateRegionalMarketAfterPurchase(
  demand: Record<string, number>,
  standing: Record<string, number>,
  regionId: string,
  units = 1,
): {
  nextDemand: Record<string, number>;
  nextStanding: Record<string, number>;
} {
  const bought = Math.max(1, Math.floor(safeNumber(units, 1)));
  return {
    nextDemand: {
      ...demand,
      [regionId]: clampDemand(
        marketDemandOf(demand, regionId) + MARKET_DEMAND_PER_PURCHASE * bought,
      ),
    },
    nextStanding: {
      ...standing,
      [regionId]: clampStanding(
        marketStandingOf(standing, regionId) +
          MARKET_STANDING_PER_PURCHASE * bought,
      ),
    },
  };
}

/**
 * Недельное затухание: спрос тянется вниз к базе, влияние падает на 0.5.
 * Обе величины зажимаются в допустимые границы, NaN в сейве не ломает неделю.
 */
export function decayMarketDynamics(
  demand: Record<string, number>,
  standing: Record<string, number>,
): {
  nextDemand: Record<string, number>;
  nextStanding: Record<string, number>;
} {
  const nextDemand: Record<string, number> = {};
  for (const regionId of Object.keys(demand ?? {})) {
    nextDemand[regionId] = clampDemand(
      marketDemandOf(demand, regionId) - MARKET_DEMAND_DECAY,
    );
  }

  const nextStanding: Record<string, number> = {};
  for (const regionId of Object.keys(standing ?? {})) {
    nextStanding[regionId] = clampStanding(
      marketStandingOf(standing, regionId) - MARKET_STANDING_DECAY,
    );
  }

  return { nextDemand, nextStanding };
}

/** Ценовой тир региона для UI: покупать, нейтрально или дорого. */
export type MarketTier = "source" | "neutral" | "premium";

export function marketTier(demand: number): MarketTier {
  const value = clampDemand(demand);
  if (value <= ARBITRAGE_SOURCE_DEMAND) return "source";
  if (value >= ARBITRAGE_TARGET_DEMAND) return "premium";
  return "neutral";
}

export const MARKET_TIER_LABELS: Record<MarketTier, string> = {
  source: "Рынок-источник",
  neutral: "Смешанный рынок",
  premium: "Рынок сбыта",
};

export interface ArbitrageQuote {
  /** Регион покупки. */
  sourceRegionId: string;
  /** Регион перепродажи. */
  targetRegionId: string;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  marginPct: number;
  /** True, когда маржа перекрывает порог ARBITRAGE_MIN_MARGIN_PCT. */
  profitable: boolean;
}

/**
 * Арбитражная выгода: покупка на рынке-источнике и перепродажа на рынке
 * сбыта. Обе цены считаются той же формулой, что и в UI рынка, поэтому
 * обещанная здесь маржа совпадает с цифрами в карточке.
 */
export function calculateArbitrage(input: {
  basePrice: number;
  sourceRegionId: string;
  targetRegionId: string;
  demand: Record<string, number>;
  standing: Record<string, number>;
}): ArbitrageQuote {
  const buyPrice = calculateFinalMarketPrice(
    input.basePrice,
    marketDemandOf(input.demand, input.sourceRegionId),
    marketStandingOf(input.standing, input.sourceRegionId),
  );
  const sellPrice = calculateFinalMarketPrice(
    input.basePrice,
    marketDemandOf(input.demand, input.targetRegionId),
    marketStandingOf(input.standing, input.targetRegionId),
  );
  const margin = sellPrice - buyPrice;
  const marginPct = buyPrice > 0 ? margin / buyPrice : 0;
  return {
    sourceRegionId: input.sourceRegionId,
    targetRegionId: input.targetRegionId,
    buyPrice,
    sellPrice,
    margin,
    marginPct,
    profitable: margin > 0 && marginPct >= ARBITRAGE_MIN_MARGIN_PCT,
  };
}

/**
 * Лучшая связка «купить здесь — продать там» для каталога регионов.
 * Возвращает null, если данных нет или ни одна пара не выгодна.
 */
export function findBestArbitrage(input: {
  basePrice: number;
  demand: Record<string, number>;
  standing: Record<string, number>;
  regionIds?: string[];
}): ArbitrageQuote | null {
  const regionIds = input.regionIds ?? Object.keys(input.demand ?? {});
  if (regionIds.length < 2) return null;
  let best: ArbitrageQuote | null = null;
  for (const sourceRegionId of regionIds) {
    for (const targetRegionId of regionIds) {
      if (sourceRegionId === targetRegionId) continue;
      const quote = calculateArbitrage({
        basePrice: input.basePrice,
        sourceRegionId,
        targetRegionId,
        demand: input.demand,
        standing: input.standing,
      });
      if (!best || quote.marginPct > best.marginPct) best = quote;
    }
  }
  return best && best.profitable ? best : null;
}

/**
 * Нормализация поля сейва: только конечные числа известных регионов,
 * значения зажимаются в диапазон. Битый словарь превращается в пустой.
 */
export function normalizeDemandMap(
  raw: unknown,
  knownRegionIds?: string[],
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = knownRegionIds ? new Set(knownRegionIds) : null;
  const result: Record<string, number> = {};
  for (const [regionId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (allowed && !allowed.has(regionId)) continue;
    // `null`/`undefined`/пустая строка — это битое поле, а не нулевой спрос.
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    result[regionId] = clampDemand(parsed);
  }
  return result;
}

export function normalizeStandingMap(
  raw: unknown,
  knownRegionIds?: string[],
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = knownRegionIds ? new Set(knownRegionIds) : null;
  const result: Record<string, number> = {};
  for (const [regionId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (allowed && !allowed.has(regionId)) continue;
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    result[regionId] = clampStanding(parsed);
  }
  return result;
}

/**
 * Цена кандидата с учётом рынка. Возвращает исходную цену без изменений,
 * если рынок нейтрален, чтобы старые сохранения не переоценивались скачком.
 */
export function marketAdjustedPrice(
  listPrice: number,
  demand: Record<string, number>,
  standing: Record<string, number>,
  regionId: string,
): number {
  return calculateFinalMarketPrice(
    listPrice,
    marketDemandOf(demand, regionId),
    marketStandingOf(standing, regionId),
  );
}

/** Регионы, у которых есть собственный рынок (id из REGIONS). */
export const MARKET_REGION_IDS = [
  '01_north_america',
  '02_south_america',
  '03_western_europe',
  '04_eastern_europe',
  '05_middle_east',
  '06_north_africa',
  '07_west_africa',
  '08_central_africa',
  '09_east_south_africa',
  '10_central_asia',
  '11_east_asia',
  '12_south_asia',
  '13_southeast_asia',
  '14_australia_oceania',
  '15_roma',
  '16_jewish_diaspora',
  '17_pacific_islands'
] as const;

/**
 * Стартовый спрос: у богатых рынков он выше базы, у регионов-источников —
 * ниже, поэтому арбитражный цикл «купить в источнике — продать в премиуме»
 * доступен с первой недели.
 */
const INITIAL_DEMAND: Record<string, number> = {
  '01_north_america': 1.1,
  '02_south_america': 0.85,
  '03_western_europe': 1.25,
  '04_eastern_europe': 0.8,
  '05_middle_east': 1.4,
  '06_north_africa': 1.35,
  '07_west_africa': 0.78,
  '08_central_africa': 0.75,
  '09_east_south_africa': 0.9,
  '10_central_asia': 0.8,
  '11_east_asia': 1.2,
  '12_south_asia': 0.82,
  '13_southeast_asia': 0.88,
  '14_australia_oceania': 1,
  '15_roma': 0.92,
  '16_jewish_diaspora': 1.05,
  '17_pacific_islands': 0.9
};

/** Стартовое влияние: везде нейтральные 50, кроме домашнего региона. */
export function createInitialMarketDemand(): Record<string, number> {
  return normalizeDemandMap(INITIAL_DEMAND, [...MARKET_REGION_IDS]);
}

export function createInitialRegionalStanding(): Record<string, number> {
  const standing: Record<string, number> = {};
  for (const regionId of MARKET_REGION_IDS) {
    standing[regionId] = MARKET_STANDING_DEFAULT;
  }
  return standing;
}
