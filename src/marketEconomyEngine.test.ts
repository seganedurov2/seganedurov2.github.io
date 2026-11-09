import { describe, expect, it } from 'vitest';
import {
  ARBITRAGE_MIN_MARGIN_PCT,
  ARBITRAGE_SOURCE_DEMAND,
  ARBITRAGE_TARGET_DEMAND,
  MARKET_DEMAND_BASE,
  MARKET_DEMAND_MAX,
  MARKET_DEMAND_MIN,
  MARKET_STANDING_DEFAULT,
  MARKET_TIER_LABELS,
  calculateArbitrage,
  calculateFinalMarketPrice,
  clampDemand,
  clampStanding,
  computeWeeklyTotals,
  decayMarketDynamics,
  findBestArbitrage,
  marketAdjustedPrice,
  marketDemandOf,
  marketStandingOf,
  marketTier,
  normalizeDemandMap,
  normalizeStandingMap,
  safeAmount,
  safeNumber,
  updateRegionalMarketAfterPurchase
} from './marketEconomyEngine';

describe('marketEconomyEngine (0.6.5 — рынок и спрос)', () => {
  describe('safeNumber / safeAmount / computeWeeklyTotals', () => {
    it('turns NaN, Infinity and garbage into fallbacks', () => {
      expect(safeNumber(NaN, 7)).toBe(7);
      expect(safeNumber('Infinity')).toBe(0);
      expect(safeNumber('12.5')).toBe(12.5);
      expect(safeNumber(undefined, 3)).toBe(3);
      expect(safeAmount(-40)).toBe(0);
      expect(safeAmount(-40.5)).toBe(0);
      expect(safeAmount(41.9)).toBe(41);
      expect(safeAmount('abc')).toBe(0);
    });

    it('sums a weekly report without letting a single NaN poison it', () => {
      const totals = computeWeeklyTotals(
        { venue: 5000, caravans: NaN, city: undefined, boiler: 120 },
        { wages: 2000, hospital: 500, city: Infinity, warehouse: 200 }
      );
      expect(totals).toEqual({ revenue: 5120, expenses: 2700, net: 2420 });
      expect(Number.isFinite(totals.net)).toBe(true);
    });

    it('keeps an all-broken week at zero instead of NaN', () => {
      expect(computeWeeklyTotals({ a: NaN }, { b: NaN })).toEqual({ revenue: 0, expenses: 0, net: 0 });
    });
  });

  describe('demand and standing', () => {
    it('clamps demand and standing into their ranges', () => {
      expect(clampDemand(Number.NaN)).toBe(MARKET_DEMAND_BASE);
      expect(clampDemand(9)).toBe(MARKET_DEMAND_MAX);
      expect(clampDemand(0)).toBe(MARKET_DEMAND_MIN);
      expect(clampStanding(-5)).toBe(0);
      expect(clampStanding(150)).toBe(100);
      expect(clampStanding(undefined)).toBe(MARKET_STANDING_DEFAULT);
      expect(marketDemandOf({}, 'nowhere')).toBe(MARKET_DEMAND_BASE);
      expect(marketStandingOf({}, 'nowhere')).toBe(MARKET_STANDING_DEFAULT);
    });

    it('raises demand and standing on a purchase', () => {
      const demand = { r1: 1 };
      const standing = { r1: 50 };
      const next = updateRegionalMarketAfterPurchase(demand, standing, 'r1');
      expect(next.nextDemand.r1).toBeCloseTo(1.05);
      expect(next.nextStanding.r1).toBe(51);
      // Исходные словари не мутируются.
      expect(demand).toEqual({ r1: 1 });
      expect(standing).toEqual({ r1: 50 });
    });

    it('caps demand for bulk purchases and ignores broken keys', () => {
      const next = updateRegionalMarketAfterPurchase({ r1: 1.99 }, {}, 'r1', 50);
      expect(next.nextDemand.r1).toBe(MARKET_DEMAND_MAX);
      expect(next.nextStanding.r1).toBe(MARKET_STANDING_DEFAULT + 50);
    });

    it('decays demand towards the base and standing downwards each week', () => {
      const next = decayMarketDynamics({ r1: 1.5, r2: Number.NaN }, { r1: 80, r2: Number.NaN });
      expect(next.nextDemand.r1).toBeCloseTo(1.48);
      expect(next.nextDemand.r2).toBeGreaterThanOrEqual(MARKET_DEMAND_MIN);
      expect(next.nextStanding.r1).toBeCloseTo(79.5);
      expect(next.nextStanding.r2).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(next.nextStanding.r2)).toBe(true);
    });

    it('never decays below the floor', () => {
      let demand: Record<string, number> = { r1: 1 };
      let standing: Record<string, number> = { r1: 2 };
      for (let week = 0; week < 40; week++) {
        const next: { nextDemand: Record<string, number>; nextStanding: Record<string, number> } = decayMarketDynamics(demand, standing);
        demand = next.nextDemand;
        standing = next.nextStanding;
      }
      expect(demand.r1).toBe(MARKET_DEMAND_MIN);
      expect(standing.r1).toBe(0);
      expect(Number.isFinite(demand.r1)).toBe(true);
    });
  });

  describe('pricing', () => {
    it('applies demand and the standing discount', () => {
      expect(calculateFinalMarketPrice(100000, 1, 0)).toBe(100000);
      expect(calculateFinalMarketPrice(100000, 1, 100)).toBe(80000);
      expect(calculateFinalMarketPrice(100000, 1.5, 50)).toBe(135000);
      expect(calculateFinalMarketPrice(100000, 1, 50)).toBe(90000);
    });

    it('survives broken inputs', () => {
      expect(calculateFinalMarketPrice(Number.NaN, Number.NaN, Number.NaN)).toBe(0);
      expect(calculateFinalMarketPrice(-500, 1, 50)).toBe(0);
      expect(Number.isFinite(calculateFinalMarketPrice(1000, 99, 99))).toBe(true);
      expect(marketAdjustedPrice(100000, {}, {}, 'r1')).toBe(90000);
    });
  });

  describe('arbitrage', () => {
    // Спрос 0.5 — минимально допустимый (MARKET_DEMAND_MIN = 0.75 ниже только у
    // рынка-источника при выборе клэмпа; берём валидные крайние значения.
    const demand = { src: 0.75, mid: 1, dst: 1.6 };
    const standing = { src: 50, mid: 50, dst: 50 };

    it('shows a profitable buy-low / sell-high pair', () => {
      const quote = calculateArbitrage({ basePrice: 100000, sourceRegionId: 'src', targetRegionId: 'dst', demand, standing });
      // 100000 * 0.75 * 0.9 = 67500; 100000 * 1.6 * 0.9 = 144000.
      expect(quote.buyPrice).toBe(67500);
      expect(quote.sellPrice).toBe(144000);
      expect(quote.margin).toBe(76500);
      expect(quote.profitable).toBe(true);
      expect(quote.marginPct).toBeGreaterThan(ARBITRAGE_MIN_MARGIN_PCT);
    });

    it('rejects an upside-down pair', () => {
      const quote = calculateArbitrage({ basePrice: 100000, sourceRegionId: 'dst', targetRegionId: 'src', demand, standing });
      expect(quote.margin).toBeLessThan(0);
      expect(quote.profitable).toBe(false);
    });

    it('finds the best route and returns null for a flat market', () => {
      const best = findBestArbitrage({ basePrice: 100000, demand, standing });
      expect(best?.sourceRegionId).toBe('src');
      expect(best?.targetRegionId).toBe('dst');
      expect(ARBITRAGE_TARGET_DEMAND).toBeLessThan(MARKET_DEMAND_MAX);
      expect(findBestArbitrage({ basePrice: 100000, demand: { a: 1 }, standing: {} })).toBeNull();
      expect(findBestArbitrage({ basePrice: 100000, demand: { a: 1, b: 1 }, standing: {} })).toBeNull();
    });

    it('labels market tiers for the UI', () => {
      expect(marketTier(MARKET_DEMAND_MIN)).toBe('source');
      expect(marketTier(ARBITRAGE_SOURCE_DEMAND)).toBe('source');
      expect(marketTier(ARBITRAGE_TARGET_DEMAND)).toBe('premium');
      expect(marketTier(1.4)).toBe('premium');
      expect(MARKET_TIER_LABELS.premium).toBe('Рынок сбыта');
    });
  });

  describe('save normalization', () => {
    it('drops unknown regions and non-finite values, keeping the ranges', () => {
      const demand = normalizeDemandMap(
        { r1: 1.4, r2: Number.NaN, r3: '2.9', r4: null, other: 1.2 },
        ['r1', 'r2', 'r3', 'r4']
      );
      // `null` — битое поле, а не нулевой спрос: регион просто выпадает.
      expect(demand).toEqual({ r1: 1.4, r3: MARKET_DEMAND_MAX });
      expect(normalizeStandingMap({ r1: 120, r2: 'abc', r3: -4 }, ['r1', 'r2', 'r3'])).toEqual({ r1: 100, r3: 0 });
    });

    it('turns a corrupt field into an empty map', () => {
      expect(normalizeDemandMap('not-a-map')).toEqual({});
      expect(normalizeStandingMap(null)).toEqual({});
      // Массив — не словарь регионов, но ключи-индексы читаются как числа и
      // зажимаются в диапазон спроса: 3 → MARKET_DEMAND_MAX.
      expect(normalizeDemandMap([1, 2, 3])).toEqual({ '0': 1, '1': 2, '2': MARKET_DEMAND_MAX });
    });
  });
});
