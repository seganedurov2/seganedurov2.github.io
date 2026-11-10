import { describe, expect, it, vi } from 'vitest';
import type { CaptureOperation, CaptureTargetQuality } from './captureOpsEngine';
import {
  baseBountyFor,
  captureChanceFor,
  committedCaptureSpend,
  createCaptureOperation,
  generateCaptureTarget,
  generateCodename,
  isOnCaptureOp,
  recommendedBudget,
  resolveCaptureArrival,
  type CaptureResolution
} from './captureOpsEngine';
import type { Character } from './gameEngine';

const squad: Character[] = [
  { id: 's1', name: 'Лидер', gender: 'women', region: '04_eastern_europe', regionName: 'Восточная Европа и Балканы', age: 32, role: 'overseer', price: 5000, skill: 70, loyalty: 80, image: '', model3d: undefined, assignedTask: undefined, assignedVenue: 'trade', managerialRole: 'none', managedBy: null, acquired: false, acquiredWeek: 1, healthLevel: 'Good', exhaustionLevel: 'Rested', exactHealth: 90, exactExhaustion: 10, headHairStyle: 'short', headHairLength: 10, facialHairStyle: 'none', pubicHairStyle: 'trimmed', pubicHairLength: 'trimmed', tanningLevel: 50, skinCondition: 'Clear', submission: 30, pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 }, pregnancy: undefined, isSlave: false, slaveOrigin: undefined, trainedAtEmporium: false, biography: '' },
  { id: 's2', name: 'Боец', gender: 'men', region: '04_eastern_europe', regionName: 'Восточная Европа и Балканы', age: 28, role: 'guard', price: 4000, skill: 60, loyalty: 70, image: '', model3d: undefined, assignedTask: undefined, assignedVenue: 'trade', managerialRole: 'none', managedBy: null, acquired: false, acquiredWeek: 1, healthLevel: 'Good', exhaustionLevel: 'Rested', exactHealth: 85, exactExhaustion: 15, headHairStyle: 'short', headHairLength: 8, facialHairStyle: 'none', pubicHairStyle: 'trimmed', pubicHairLength: 'trimmed', tanningLevel: 45, skinCondition: 'Clear', submission: 25, pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 }, pregnancy: undefined, isSlave: false, slaveOrigin: undefined, trainedAtEmporium: false, biography: '' }
];

describe('captureOpsEngine 0.7.2', () => {
  describe('captureChanceFor', () => {
    it('clamps between 5 and 95', () => {
      // elite target in deadliest region with unskilled squad -> floor
      const raw = [{ ...squad[0], skill: 5, loyalty: 5 }, { ...squad[1], skill: 5, loyalty: 5 }];
      expect(captureChanceFor('elite', raw, '08_central_africa', 0)).toBe(5);
      // low target in safest region with great squad and max funding -> ceiling
      const great = [...squad].map(c => ({ ...c, skill: 100, loyalty: 100 }));
      expect(captureChanceFor('low', great, '03_western_europe', 1000000)).toBe(95);
    });
    it('decreases with target quality', () => {
      const base = { squad, regionId: '04_eastern_europe', budget: 0 } as const;
      expect(captureChanceFor('low', base.squad, base.regionId, base.budget)).toBeGreaterThan(captureChanceFor('elite', base.squad, base.regionId, base.budget));
    });
    it('increases with squad skill', () => {
      const skilled = [...squad].map(c => ({ ...c, skill: 90 }));
      expect(captureChanceFor('medium', skilled, '04_eastern_europe', 0)).toBeGreaterThan(captureChanceFor('medium', squad, '04_eastern_europe', 0));
    });
    it('decreases with region danger', () => {
      expect(captureChanceFor('medium', squad, '03_western_europe', 0)).toBeGreaterThan(captureChanceFor('medium', squad, '08_central_africa', 0));
    });
    it('rewards funding up to the reference budget, then saturates', () => {
      const ref = recommendedBudget('medium', '04_eastern_europe');
      const underfunded = captureChanceFor('medium', squad, '04_eastern_europe', Math.floor(ref * 0.5));
      const recommended = captureChanceFor('medium', squad, '04_eastern_europe', ref);
      const overfunded = captureChanceFor('medium', squad, '04_eastern_europe', ref * 3);
      expect(underfunded).toBeLessThan(recommended);
      expect(overfunded).toBeGreaterThanOrEqual(recommended);
    });
    it('gives size bonus for squads larger than the minimum', () => {
      const trio = [...squad, { ...squad[0], id: 's3' }];
      expect(captureChanceFor('medium', trio, '04_eastern_europe', 0)).toBeGreaterThan(captureChanceFor('medium', squad, '04_eastern_europe', 0));
    });
  });

  describe('recommendedBudget', () => {
    it('is positive and scales with quality and danger', () => {
      expect(recommendedBudget('low', '03_western_europe')).toBeGreaterThan(0);
      expect(recommendedBudget('elite', '08_central_africa')).toBeGreaterThan(recommendedBudget('low', '03_western_europe'));
      expect(recommendedBudget('medium', '08_central_africa')).toBeGreaterThan(recommendedBudget('medium', '03_western_europe'));
    });
  });

  describe('generateCodename', () => {
    it('returns a name not present in usedNames', () => {
      const used = ['Операция Бархатная ловушка', 'Контракт Железная сеть'];
      const name = generateCodename(used);
      expect(used).not.toContain(name);
    });
    it('falls back with a suffix when every combination is exhausted', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const all = new Array(12).fill('').map((_, i) => `Операция ${['Бархатная ловушка','Железная сеть','Полночное похищение','Солёная лилия','Сломанная клятва','Багровый счёт','Молчаливый регистр','Чёрный регистр','Кобальтовый шёпот','Пустое обещание'][i % 10]}`);
      const name = generateCodename(all);
      expect(name).toContain(String(all.length + 1));
      vi.restoreAllMocks();
    });
  });

  describe('createCaptureOperation', () => {
    it('builds a complete outbound operation with deterministic fields', () => {
      const budget = recommendedBudget('medium', '04_eastern_europe');
      const op = createCaptureOperation({ codename: 'Операция Тест', targetRegionId: '04_eastern_europe', targetRegionName: 'Восточная Европа и Балканы', targetQuality: 'medium', budget, squad });
      expect(op.id.startsWith('capture_')).toBe(true);
      expect(op.codename).toBe('Операция Тест');
      expect(op.targetName).toBeTruthy();
      expect(op.targetRegionId).toBe('04_eastern_europe');
      expect(op.targetQuality).toBe('medium');
      expect(op.upfrontCost).toBe(budget);
      expect(op.bounty).toBeGreaterThan(0);
      expect(op.leaderId).toBe('s1');
      expect(op.leaderName).toBe('Лидер');
      expect(op.squadIds).toEqual(['s1', 's2']);
      expect(op.squadSize).toBe(2);
      expect(op.weeksTotal).toBe(2);
      expect(op.weeksRemaining).toBe(2);
      expect(op.status).toBe('outbound');
      expect(op.raidsTriggered).toBe(0);
      expect(op.captureChance).toBeGreaterThanOrEqual(5);
      expect(op.captureChance).toBeLessThanOrEqual(95);
      expect(op.routeDanger).toBeGreaterThanOrEqual(0);
      expect(op.routeDanger).toBeLessThanOrEqual(1);
    });
  });

  describe('resolveCaptureArrival with controlled RNG', () => {
    const op: CaptureOperation = {
      id: 'cap_1', codename: 'Операция Тест', targetName: 'Цель А', targetRegionId: '04_eastern_europe',
      targetRegionName: 'Восточная Европа и Балканы', targetQuality: 'medium', upfrontCost: 30000, bounty: 50000,
      leaderId: 's1', leaderName: 'Лидер', squadIds: ['s1', 's2'], squadSize: 2, squadAvgSkill: 65, squadAvgLoyalty: 75,
      weeksTotal: 2, weeksRemaining: 2, status: 'outbound', raidsTriggered: 0, captureChance: 70, routeDanger: 0.45
    };

    it('success: captures target, pays bounty, completed status', () => {
      const res = resolveCaptureArrival(op, () => 0.01) as CaptureResolution;
      expect(res.success).toBe(true);
      expect(res.captured).not.toBeNull();
      expect(res.captured?.name).toBe('Цель А');
      expect(res.fundsDelta).toBe(50000);
      expect(res.status).toBe('completed');
      expect(res.squadLostIds).toEqual([]);
      expect(res.squadWoundedIds).toEqual([]);
      expect(res.message).toContain('захвачена');
    });

    it('failure without wipeout: wounded squad, failed status, reputation penalty', () => {
      const res = resolveCaptureArrival({ ...op, captureChance: 0 }, () => 0.99) as CaptureResolution;
      expect(res.success).toBe(false);
      expect(res.captured).toBeNull();
      expect(res.status).toBe('failed');
      expect(res.reputationDelta).toBe(-3);
      expect(res.squadLostIds).toEqual([]);
      expect(res.squadWoundedIds.length).toBeGreaterThan(0);
      expect(res.message).toContain('отбила');
    });

    it('wipeout in lawless region: whole squad lost, lost status', () => {
      const wipeoutOp = { ...op, targetQuality: 'elite' as CaptureTargetQuality, captureChance: 0, routeDanger: 0.9 };
      // force squadLost: wipeoutChance for elite in 0.9 danger = min(0.4, 0.06+0.162+0.12) = 0.342 -> random 0.1 triggers
      const res = resolveCaptureArrival(wipeoutOp, () => 0.1) as CaptureResolution;
      expect(res.success).toBe(false);
      expect(res.status).toBe('lost');
      expect(res.squadLostIds).toEqual(['s1', 's2']);
      expect(res.reputationDelta).toBe(-6);
    });
  });

  describe('committedCaptureSpend', () => {
    it('sums upfront costs of outbound operations only', () => {
      const base: CaptureOperation = {
        id: 'cap_x', codename: 'X', targetName: 'Цель', targetRegionId: '04_eastern_europe',
        targetRegionName: 'Регион', targetQuality: 'medium', upfrontCost: 10000, bounty: 50000,
        leaderId: 's1', leaderName: 'Лидер', squadIds: ['s1', 's2'], squadSize: 2, squadAvgSkill: 65,
        squadAvgLoyalty: 75, weeksTotal: 2, weeksRemaining: 2, status: 'outbound', raidsTriggered: 0,
        captureChance: 70, routeDanger: 0.45
      };
      const ops: CaptureOperation[] = [
        { ...base, id: 'a', upfrontCost: 10000, status: 'outbound' },
        { ...base, id: 'b', upfrontCost: 20000, status: 'completed' },
        { ...base, id: 'c', upfrontCost: 30000, status: 'failed' },
        { ...base, id: 'd', upfrontCost: 40000, status: 'lost' }
      ];
      expect(committedCaptureSpend(ops)).toBe(10000);
      expect(committedCaptureSpend([])).toBe(0);
    });
  });

  describe('generateCaptureTarget', () => {
    it('assigns elite role for elite quality', () => {
      const t = generateCaptureTarget('04_eastern_europe', 'elite');
      expect(t.role).toBe('Похищенная элита (пленный)');
    });
    it('assigns slave role for non-elite', () => {
      const t = generateCaptureTarget('04_eastern_europe', 'low');
      expect(t.role).toBe('Похищенная цель (пленный)');
    });
  });

  describe('isOnCaptureOp', () => {
    it('flags deployed operatives', () => {
      expect(isOnCaptureOp({ ...squad[0], assignedTask: 'capture_op:cap_1' })).toBe(true);
      expect(isOnCaptureOp({ ...squad[0], assignedTask: undefined })).toBe(false);
    });
  });

  describe('baseBountyFor', () => {
    it('returns tier base values', () => {
      expect(baseBountyFor('low')).toBe(22000);
      expect(baseBountyFor('elite')).toBe(95000);
    });
  });
});
