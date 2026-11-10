import { describe, expect, it } from 'vitest';
import {
  weeklyHealthWear,
  EXHAUSTION_UPGRADES
} from './exhaustionEngine';

describe('exhaustionEngine (weekly health wear)', () => {
  it('unassigned venue heals instead of wearing', () => {
    expect(weeklyHealthWear('unassigned', 0)).toBeLessThanOrEqual(0);
    expect(weeklyHealthWear('unassigned', 100)).toBe(-2);
    expect(weeklyHealthWear('unassigned', 50)).toBe(-2);
    expect(weeklyHealthWear('unassigned', 25)).toBe(-1);
  });

  it('trade venue costs 1 shift plus fatigue tier', () => {
    expect(weeklyHealthWear('trade', 0)).toBe(1);
    expect(weeklyHealthWear('trade', 24)).toBe(1);
    expect(weeklyHealthWear('trade', 25)).toBe(2);
    expect(weeklyHealthWear('trade', 50)).toBe(3);
    expect(weeklyHealthWear('trade', 100)).toBe(5);
  });

  it('non-trade venue costs 2 shift plus fatigue tier', () => {
    expect(weeklyHealthWear('pleasure_house', 0)).toBe(2);
    expect(weeklyHealthWear('pleasure_house', 24)).toBe(2);
    expect(weeklyHealthWear('pleasure_house', 25)).toBe(3);
    expect(weeklyHealthWear('pleasure_house', 100)).toBe(6);
  });

  it('clamps exhaustion to 0..100', () => {
    expect(weeklyHealthWear('trade', -10)).toBe(1);
    expect(weeklyHealthWear('trade', 200)).toBe(5);
  });
});

describe('exhaustionEngine (upgrade tiers)', () => {
  it('each venue has 4 levels, costs and descriptions', () => {
    for (const venue of Object.keys(EXHAUSTION_UPGRADES) as Array<keyof typeof EXHAUSTION_UPGRADES>) {
      const upg = EXHAUSTION_UPGRADES[venue];
      expect(upg.level).toBe(0);
      expect(upg.maxLevel).toBeGreaterThanOrEqual(1);
      expect(upg.costs).toHaveLength(4);
      expect(upg.costs[0]).toBe(0);
      expect(upg.effectDescriptions).toHaveLength(4);
      expect(upg.costs.every(c => typeof c === 'number' && c >= 0)).toBe(true);
    }
  });

  it('pleasure_house costs escalate', () => {
    const upg = EXHAUSTION_UPGRADES.pleasure_house;
    expect(upg.costs).toEqual([0, 20000, 50000, 100000]);
    expect(upg.costs).toEqual([...upg.costs].sort((a, b) => a - b));
  });

  it('strip_club costs escalate', () => {
    const upg = EXHAUSTION_UPGRADES.strip_club;
    expect(upg.costs).toEqual([0, 25000, 60000, 120000]);
  });

  it('beauty_salon costs escalate', () => {
    const upg = EXHAUSTION_UPGRADES.beauty_salon;
    expect(upg.costs).toEqual([0, 15000, 40000, 90000]);
  });
});
