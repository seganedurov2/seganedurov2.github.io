import { describe, expect, it } from 'vitest';
import type { Character } from './gameEngine';
import {
  assessSlaveUnrest,
  applyBdsmTraining,
  applySlaveBreaking,
  contractRiskReason,
  deliverSlaves,
  claimContractKpi,
  effectiveRiskPercent,
  eligibleSlaves,
  generateSlaveContract,
  generateTradeSupplyContract,
  marketValueOf,
  meetsQualityRequirement,
  regionalSlavePrice,
  slaveQualityOf,
  supplyContractRisk,
  type SlaveBuyerContract
} from './slaveContractsEngine';

const baseChar = (overrides: Partial<Character> = {}): Character => ({
  id: overrides.id ?? 'c1',
  name: overrides.name ?? 'Test',
  age: 25,
  gender: 'women',
  role: 'Captive',
  region: '01_north_america',
  regionName: 'Test',
  price: 1000,
  skill: 50,
  submission: 50,
  loyalty: 50,
  healthLevel: 'Good',
  exactHealth: 80,
  exhaustionLevel: 'Rested',
  exactExhaustion: 10,
  headHairStyle: 'none',
  headHairLength: 0,
  facialHairStyle: 'none',
  pubicHairStyle: 'none',
  pubicHairLength: 'none',
  tanningLevel: 0,
  skinCondition: 'Clear',
  image: '',
  pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 },
  managerialRole: 'none',
  isSlave: true,
  assignedVenue: 'unassigned',
  ...overrides
});

describe('slaveContractsEngine 0.6.6', () => {
  it('computes quality and eligibility deterministically', () => {
    const low = baseChar({ skill: 10, submission: 10 });
    const high = baseChar({ skill: 80, submission: 90 });
    expect(slaveQualityOf(low)).toBe('low');
    expect(slaveQualityOf(high)).toBe('high');
    expect(meetsQualityRequirement(high, 'medium')).toBe(true);
    expect(meetsQualityRequirement(low, 'medium')).toBe(false);
    expect(meetsQualityRequirement(low, 'any')).toBe(true);
  });

  it('generates valid slave contracts with safe numeric fields', () => {
    for (let i = 0; i < 25; i++) {
      const c = generateSlaveContract(i % 2 === 0 ? 'market' : 'black_market', Math.floor(i / 5));
      expect(c.id).toMatch(/^slavecontract_/);
      expect(c.quantityWanted).toBeGreaterThanOrEqual(1);
      expect(c.quantityDelivered).toBe(0);
      expect(c.weeksRemaining).toBeGreaterThanOrEqual(1);
      expect(c.pricePerHead).toBeGreaterThan(0);
      expect(Number.isFinite(c.pricePerHead)).toBe(true);
      expect(c.riskPercent).toBeGreaterThanOrEqual(0);
      expect(c.riskPercent).toBeLessThanOrEqual(100);
      expect(['active', 'completed', 'failed']).toContain(c.status);
      expect(['any', 'low', 'medium', 'high', 'legendary']).toContain(c.minQuality);
    }
  });

  it('delivers only eligible slaves up to quantity wanted', () => {
    const contract: SlaveBuyerContract = {
      id: 'sc1',
      channel: 'market',
      buyerName: 'Buyer',
      buyerType: 'Частное имение',
      title: 'Test',
      description: '',
      regionId: '03_western_europe',
      regionName: 'Western Europe',
      quantityWanted: 2,
      quantityDelivered: 0,
      minQuality: 'medium',
      pricePerHead: 10000,
      demandTier: 'high',
      sourcePriceBenchmark: 1750,
      rewardReputation: 2,
      riskReputation: 2,
      riskPercent: 5,
      weeksRemaining: 3,
      status: 'active'
    };
    const roster = [
      baseChar({ id: 'a', skill: 90, submission: 90 }),
      baseChar({ id: 'b', skill: 10, submission: 10 }),
      baseChar({ id: 'c', skill: 70, submission: 60 })
    ];
    expect(eligibleSlaves(roster, contract).map(c => c.id)).toEqual(['a', 'c']);
    const res = deliverSlaves(contract, roster);
    expect(res.deliveredIds).toEqual(['a', 'c']);
    expect(res.contract.quantityDelivered).toBe(2);
    expect(res.contract.status).toBe('completed');
  });

  it('clamps effective risk and exposes risk reason', () => {
    const contract = generateSlaveContract('black_market');
    expect(effectiveRiskPercent(contract, 999)).toBe(0);
    expect(Number.isFinite(marketValueOf(baseChar({ skill: 999, submission: 999 })))).toBe(true);
    expect(regionalSlavePrice('08_central_africa', 'low')).toBeGreaterThan(0);
    const reason = contractRiskReason({ ...contract, riskPercent: 12, riskReputation: 4 }, 2, { buyerPriceMultiplier: 1, buyerQuantityBonus: 0, supplyDiscountBonus: 0, lotCostMultiplier: 1, riskReduction: 1, proceedsMultiplier: 1 });
    expect(reason).toContain('9%');
    expect(reason).toContain('реп. −4');
  });

  it('assesses unrest safely for empty and populated rosters', () => {
    expect(assessSlaveUnrest([], [])).toEqual({ unrestIndex: 0, escapeChance: 0, atRiskIds: [] });
    const unrest = assessSlaveUnrest(
      [baseChar({ loyalty: 5, exhaustionLevel: 'Burned Out', healthLevel: 'Critical' })],
      []
    );
    expect(unrest.unrestIndex).toBeGreaterThanOrEqual(0);
    expect(unrest.unrestIndex).toBeLessThanOrEqual(100);
    expect(unrest.escapeChance).toBeGreaterThanOrEqual(0);
  });

  it('computes supply contract disruption risk from logistics/health/security', () => {
    const supply = generateTradeSupplyContract({ regionId: '07_west_africa', regionName: 'West Africa', caravansDelivered: 8 }, 10, 0);
    const weak = supplyContractRisk(supply, { logisticsHealth: 20, securityLevel: 10, effects: { buyerPriceMultiplier: 1, buyerQuantityBonus: 0, supplyDiscountBonus: 0, lotCostMultiplier: 1, riskReduction: 0, proceedsMultiplier: 1 } });
    const strong = supplyContractRisk(supply, { logisticsHealth: 95, securityLevel: 90, effects: { buyerPriceMultiplier: 1, buyerQuantityBonus: 0, supplyDiscountBonus: 0.15, lotCostMultiplier: 1, riskReduction: 4, proceedsMultiplier: 1 } });
    expect(weak.percent).toBeGreaterThan(strong.percent);
    expect(weak.reason).toContain('срыв');
    expect(strong.percent).toBeGreaterThanOrEqual(0);
  });

  it('supports deadline/overdelivery KPI as a separate save-compatible stream', () => {
    const contract = {
      ...generateSlaveContract('market', 10),
      id: 'kpi1', quantityWanted: 2, quantityDelivered: 2, status: 'completed' as const,
      deadlineWeek: 11, quantityOverDelivered: 1, kpiOverdeliveryBonusPerHead: 500,
      kpiDeadlineBonusMoney: 1000, kpiDeadlineBonusReputation: 1, kpiBonusPaid: false,
    };
    const onTime = claimContractKpi(contract, 11);
    expect(onTime.reward?.deadlineMet).toBe(true);
    expect(onTime.reward?.money).toBe(1500);
    expect(onTime.reward?.reputation).toBe(1);
    expect(onTime.contract.kpiBonusPaid).toBe(true);
    expect(claimContractKpi(onTime.contract, 12).reward).toBeNull();

    const late = claimContractKpi({ ...contract, kpiBonusPaid: false, quantityOverDelivered: 0 }, 13);
    expect(late.reward?.deadlineMet).toBe(false);
    expect(late.reward?.money).toBe(0);

    // `generateSlaveContract` rolls a random buyer, and with it a random quality
    // bar. Pin the bar to 'any' so the fixture tests overdelivery, not luck.
    const roster = [baseChar({ id: 'o1' }), baseChar({ id: 'o2' })];
    const over = deliverSlaves({ ...contract, minQuality: 'any', quantityDelivered: 2, quantityOverDelivered: 0, status: 'completed' as const }, roster, { allowOverdelivery: true });
    expect(over.overdelivery).toBe(1);
    expect(over.contract.quantityOverDelivered).toBe(1);
  });
});

describe('slaveContractsEngine (bdsm training / breaking)', () => {
  const slave = baseChar({ isSlave: true, submission: 40, loyalty: 30 });
  const free = baseChar({ isSlave: false, submission: 40, loyalty: 30 });

  it('applyBdsmTraining: raises submission and loyalty for slaves, clamps at 100', () => {
    const out = applyBdsmTraining(slave, 10);
    expect(out.submission).toBe(50);
    expect(out.loyalty).toBe(35);
    const capped = applyBdsmTraining({ ...slave, submission: 98, loyalty: 98 }, 10);
    expect(capped.submission).toBe(100);
    expect(capped.loyalty).toBe(100);
  });

  it('applyBdsmTraining: gain <= 0 or non-slave is a no-op', () => {
    expect(applyBdsmTraining(slave, 0)).toBe(slave);
    expect(applyBdsmTraining(slave, -5)).toBe(slave);
    expect(applyBdsmTraining(free, 10)).toBe(free);
  });

  it('applySlaveBreaking: nudges submission and loyalty up with randomness', () => {
    const out = applySlaveBreaking(slave);
    expect(out.submission).toBeGreaterThanOrEqual(slave.submission);
    expect(out.loyalty).toBeGreaterThanOrEqual(slave.loyalty);
    expect(out.submission).toBeLessThanOrEqual(100);
    expect(out.loyalty).toBeLessThanOrEqual(100);
  });
});