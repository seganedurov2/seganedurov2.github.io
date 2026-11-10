import { describe, expect, it } from 'vitest';
import type { ActiveRaid, RaidOutcome } from './caravanRaidsEngine';
import {
  buildCapturedSlaves,
  dangerForRegion,
  insurancePayout,
  insurancePremium,
  raidChanceForCaravan,
  raidChanceForRoute,
  resolveRaid,
  trySpawnRaid
} from './caravanRaidsEngine';
import type { Character } from './gameEngine';

const seated = {
  id: 'c1', name: 'Седок', gender: 'women', region: '04_eastern_europe', regionName: 'Восточная Европа и Балканы',
  age: 30, role: 'guard', price: 1000, skill: 60, loyalty: 70, image: '',
  assignedTask: undefined, assignedVenue: 'trade', managerialRole: 'none', managedBy: null,
  acquired: false, acquiredWeek: 1, pregnancy: undefined, isSlave: false, slaveOrigin: undefined,
  assignedBuildingId: null
} as unknown as Character;

const caravanBase = {
  id: 'caravan_1', name: 'Тестовый караван', originRegion: 'Западная Европа и Скандинавия',
  destRegion: 'Центральная Африка', leaderName: 'Седок', leaderId: 'c1',
  investment: 20000, potentialProfit: 40000, weeksTotal: 3, weeksRemaining: 3,
  status: 'traveling' as const, raidsTriggered: 0, dispatchedWeek: 1
};

const seatedRaid: ActiveRaid = {
  missionKind: 'caravan', raidId: 'caravan_1', missionName: 'Тестовый караван',
  leaderName: 'Седок', leaderId: 'c1', destRegion: 'Центральная Африка',
  enemyType: 'bandits', enemyName: 'Тестовые налётчики', severity: 'moderate',
  leaderSkill: 60, leaderLoyalty: 70, crewSize: 2, crewAvgSkill: 60, crewAvgLoyalty: 70,
  fightChance: 60, fleeChance: 60, tributeChance: 60, tributeDemand: 5000,
  depotRiskReduction: 0, depotVictoryBonus: 0, stakeValue: 40000,
  insurancePlan: 'none', insurancePremium: 0
};

describe('caravanRaidsEngine 0.7.1', () => {
  describe('raidChanceForRoute', () => {
    it('clamps to floor 5% for the safest region and low-skill crew', () => {
      expect(raidChanceForRoute('Западная Европа и Скандинавия', 10, 45)).toBeCloseTo(0.05, 2);
    });
    it('clamps to ceiling 85% for capture in the deadliest region', () => {
      expect(raidChanceForRoute('Центральная Африка', 1, 0, 'capture')).toBe(0.85);
    });
    it('scales with destination danger', () => {
      const safe = raidChanceForRoute('Западная Европа и Скандинавия');
      const deadly = raidChanceForRoute('Центральная Африка');
      expect(deadly).toBeGreaterThan(safe);
    });
    it('caravan entry point matches route with caravan kind', () => {
      expect(raidChanceForCaravan(caravanBase)).toBe(raidChanceForRoute('Центральная Африка', 55, 0, 'caravan'));
    });
    it('respects DETERRENCE_CAP: depot cannot push below floor', () => {
      expect(raidChanceForRoute('Западная Европа и Скандинавия', 55, 1000)).toBeCloseTo(0.05, 2);
    });
  });

  describe('insurance premium / payout', () => {
    it('none costs zero and pays zero', () => {
      expect(insurancePremium('none', 100000)).toBe(0);
      expect(insurancePayout('none', 50000)).toBe(0);
    });
    it('basic: 4% premium, 20% deductible, 35% cap of stake', () => {
      expect(insurancePremium('basic', 100000)).toBe(4000);
      // loss 50000 -> after deductible 40000 -> coverage 35% = 14000, cap 35000 -> 14000
      expect(insurancePayout('basic', 50000)).toBe(14000);
      // tiny loss: deductible subtracted first, then coverage% on remainder
      expect(insurancePayout('basic', 100)).toBe(28);
    });
    it('standard: 8% premium, 12% deductible, 60% cap', () => {
      expect(insurancePremium('standard', 100000)).toBe(8000);
      expect(insurancePayout('standard', 50000)).toBe(26400);
    });
    it('full: 14% premium, 5% deductible, 85% cap', () => {
      expect(insurancePremium('full', 100000)).toBe(14000);
      expect(insurancePayout('full', 50000)).toBe(40375);
    });
  });

  describe('trySpawnRaid deterministic', () => {
    const random = () => 0.5;
    const escorts = [{ skill: 60, loyalty: 70 }];
    it('returns null when the roll misses', () => {
      // safe region, high deterrence -> chance below 0.5
      const raid = trySpawnRaid(caravanBase, seated, [seated], escorts, { riskReduction: 45 }, () => 0.99);
      expect(raid).toBeNull();
    });
    it('returns an ActiveRaid with deterministic fields when the roll hits', () => {
      const raid = trySpawnRaid(caravanBase, seated, [seated], escorts, {}, random);
      expect(raid).not.toBeNull();
      expect(raid!.missionKind).toBe('caravan');
      expect(raid!.raidId).toBe('caravan_1');
      expect(raid!.stakeValue).toBe(40000);
      expect(raid!.insurancePlan).toBe('none');
    });
    it('carries insurance plan/premium from caravan', () => {
      const insured = { ...caravanBase, insurancePlan: 'full' as const, insurancePremium: 5600 };
      const raid = trySpawnRaid(insured, seated, [seated], [], {}, random);
      expect(raid?.insurancePlan).toBe('full');
      expect(raid?.insurancePremium).toBe(5600);
    });
  });

  describe('resolveRaid with controlled RNG', () => {
    const alwaysHit = () => 0;   // random() * 100 < chance -> success
    const alwaysMiss = () => 1;  // random() * 100 >= chance -> failure

    it('fight success: rout raiders, loot, captives, status traveling', () => {
      const raid = { ...seatedRaid, fightChance: 100 };
      const out = resolveRaid(raid, 'fight', alwaysHit) as RaidOutcome;
      expect(out.success).toBe(true);
      expect(out.fundsDelta).toBeGreaterThan(0);
      expect(out.capturedSlaves).toBeGreaterThan(0);
      expect(out.resultingStatus).toBe('traveling');
      expect(out.message).toContain('отбился');
    });
    it('fight failure: losses, possible leader killed / wiped, status raided or lost', () => {
      const raid = { ...seatedRaid, fightChance: 0, missionKind: 'caravan' as const };
      const out = resolveRaid(raid, 'fight', alwaysMiss) as RaidOutcome;
      expect(out.success).toBe(false);
      expect(out.stakeLossFraction).toBeGreaterThan(0);
      expect(['raided', 'lost']).toContain(out.resultingStatus);
    });
    it('flee success: light stake loss, status traveling', () => {
      const raid = { ...seatedRaid, fleeChance: 100 };
      const out = resolveRaid(raid, 'flee', alwaysHit) as RaidOutcome;
      expect(out.success).toBe(true);
      expect(out.resultingStatus).toBe('traveling');
      expect(out.stakeLossFraction).toBeGreaterThan(0);
    });
    it('flee failure: heavier losses, reputation hit', () => {
      const raid = { ...seatedRaid, fleeChance: 0 };
      const out = resolveRaid(raid, 'flee', alwaysMiss) as RaidOutcome;
      expect(out.success).toBe(false);
      expect(out.reputationDelta).toBeLessThan(0);
    });
    it('tribute success: pay reduced amount, status traveling', () => {
      const raid = { ...seatedRaid, tributeChance: 100, tributeDemand: 10000 };
      const out = resolveRaid(raid, 'tribute', alwaysHit) as RaidOutcome;
      expect(out.success).toBe(true);
      expect(out.fundsDelta).toBeLessThan(0);
      expect(out.fundsDelta).toBeGreaterThan(-10000);
      expect(out.resultingStatus).toBe('traveling');
    });
    it('tribute failure: pay full demand, stake loss', () => {
      const raid = { ...seatedRaid, tributeChance: 0, tributeDemand: 10000 };
      const out = resolveRaid(raid, 'tribute', alwaysMiss) as RaidOutcome;
      expect(out.success).toBe(false);
      expect(out.fundsDelta).toBe(-10000);
      expect(out.stakeLossFraction).toBeGreaterThan(0);
    });
  });

  describe('applyInsurance via resolveRaid', () => {
    const alwaysMiss = () => 1;
    it('adds payout and netFundsDelta when insured and stake lost', () => {
      const raid = { ...seatedRaid, insurancePlan: 'full' as const, insurancePremium: 5600, fightChance: 0, stakeValue: 40000 };
      const out = resolveRaid(raid, 'fight', alwaysMiss) as RaidOutcome;
      expect(out.insurancePayout).toBeGreaterThan(0);
      expect(out.netFundsDelta).toBe(out.fundsDelta);
      expect(out.failureMessage).toContain('Страховка');
    });
    it('no payout when plan is none', () => {
      const raid = { ...seatedRaid, insurancePlan: 'none' as const, fightChance: 0 };
      const out = resolveRaid(raid, 'fight', alwaysMiss) as RaidOutcome;
      expect(out.insurancePayout).toBeUndefined();
      expect(out.netFundsDelta).toBeUndefined();
    });
  });

  describe('buildCapturedSlaves', () => {
    it('returns slaves only on successful outcome with captives', () => {
      const win = { success: true, capturedSlaves: 2, slaveQuality: 'high' as const };
      const slaves = buildCapturedSlaves(win as any, 'Восточная Африка');
      expect(slaves).toHaveLength(2);
      slaves.forEach(s => expect(s.slaveOrigin).toBe('caravan_raid'));
    });
    it('returns empty on failure or zero captives', () => {
      expect(buildCapturedSlaves({ success: false, capturedSlaves: 0 } as any, 'X')).toHaveLength(0);
      expect(buildCapturedSlaves({ success: true, capturedSlaves: 0 } as any, 'X')).toHaveLength(0);
    });
  });

  describe('dangerForRegion', () => {
    it('returns default 0.4 for unknown region', () => {
      expect(dangerForRegion('Неизвестная галактика')).toBe(0.4);
    });
    it('returns table value for known region', () => {
      expect(dangerForRegion('Центральная Африка')).toBe(1.0);
      expect(dangerForRegion('Западная Европа и Скандинавия')).toBe(0.1);
    });
  });
});
