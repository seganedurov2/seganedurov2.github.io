import { describe, expect, it } from 'vitest';
import {
  advanceBuildingUpgrades,
  calculateBuildingWeeklyEffects,
  checkPostCompatibility,
  getBuildingActionCost,
  getBuildingStatus,
  startBuildingUpgrade,
  BUILDING_DEFINITIONS
} from './buildingsEngine';
import { makeHiredEmployee, specializationWeeklyEffects } from './employeesEngine';
import type { AuxiliaryBuildingState, Employee, EmployeeSpecialty } from './expansionTypes';

const schoolState = (overrides: Partial<AuxiliaryBuildingState> = {}): AuxiliaryBuildingState => ({
  id: 'school',
  level: 0,
  assignedEmployeeIds: [],
  ...overrides
});

const hire = (specialty: EmployeeSpecialty, gender: 'women' | 'men' = 'women', id = `emp_${specialty}`): Employee =>
  makeHiredEmployee(
    { id, name: `Сотрудник ${specialty}`, specialty, gender, skill: 50, experience: 0, morale: 80, weeklyWage: 1000 },
    1
  );

describe('building upgrades', () => {
  it('starts construction of an unbuilt building', () => {
    const result = startBuildingUpgrade([schoolState()], 'school')!;
    expect(result.started).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.cost).toBe(18000);
    expect(result.weeks).toBe(2);
    expect(result.targetLevel).toBe(1);
    expect(result.buildings[0].level).toBe(0);
    expect(result.buildings[0].upgradeWeeksRemaining).toBe(2);
    expect(result.buildings[0].upgradeTargetLevel).toBe(1);
  });

  it('charges the upgrade cost and weeks of the next level', () => {
    const result = startBuildingUpgrade([schoolState({ level: 1 })], 'school')!;
    expect(result.cost).toBe(12000);
    expect(result.weeks).toBe(2);
    expect(result.targetLevel).toBe(2);
  });

  it('refuses max level and already upgrading buildings', () => {
    expect(startBuildingUpgrade([schoolState({ level: 3 })], 'school')).toBeNull();
    expect(startBuildingUpgrade([schoolState({ level: 0, upgradeWeeksRemaining: 2, upgradeTargetLevel: 1 })], 'school')).toBeNull();
  });

  it('getBuildingActionCost matches construction and upgrade prices', () => {
    expect(getBuildingActionCost(schoolState())).toBe(18000);
    expect(getBuildingActionCost(schoolState({ level: 1 }))).toBe(12000);
    expect(getBuildingActionCost(schoolState({ level: 3 }))).toBeNull();
  });
});

describe('advanceBuildingUpgrades', () => {
  it('counts down weeks remaining without completing early', () => {
    const buildings = [schoolState({ level: 0, upgradeWeeksRemaining: 3, upgradeTargetLevel: 1 })];
    const first = advanceBuildingUpgrades(buildings);
    expect(first.completedIds).toEqual([]);
    expect(first.buildings[0].upgradeWeeksRemaining).toBe(2);
    const second = advanceBuildingUpgrades(first.buildings);
    expect(second.buildings[0].upgradeWeeksRemaining).toBe(1);
  });

  it('completes at the target level and clears the upgrade flags', () => {
    const buildings = [schoolState({ level: 0, upgradeWeeksRemaining: 1, upgradeTargetLevel: 1 })];
    const { buildings: next, completedIds } = advanceBuildingUpgrades(buildings);
    expect(completedIds).toEqual(['school']);
    expect(next[0].level).toBe(1);
    expect(next[0].upgradeWeeksRemaining).toBe(0);
    expect(next[0].upgradeTargetLevel).toBeUndefined();
  });

  it('clamps the completed level to maxLevel', () => {
    const { buildings: next } = advanceBuildingUpgrades([schoolState({ level: 2, upgradeWeeksRemaining: 1, upgradeTargetLevel: 99 })]);
    expect(next[0].level).toBe(3);
  });

  it('leaves buildings without an upgrade untouched', () => {
    const next = advanceBuildingUpgrades([schoolState({ level: 1 })]);
    expect(next.buildings).toEqual([schoolState({ level: 1 })]);
    expect(next.completedIds).toEqual([]);
  });
});

describe('getBuildingStatus', () => {
  it('reports unbuilt, unstaffed and operating', () => {
    expect(getBuildingStatus(schoolState(), [])).toBe('unbuilt');
    const teacher = hire('teacher');
    expect(getBuildingStatus(schoolState({ level: 1, assignedEmployeeIds: [] }), [teacher])).toBe('unstaffed');
    teacher.assignedBuildingId = 'school';
    expect(getBuildingStatus(schoolState({ level: 1, assignedEmployeeIds: [teacher.id] }), [teacher])).toBe('operating');
  });
});

describe('calculateBuildingWeeklyEffects', () => {
  it('returns finite zeros with no buildings', () => {
    const effects = calculateBuildingWeeklyEffects([], []);
    expect(effects.buildingsUpkeep).toBe(0);
    expect(effects.venueRevenueBonusPercent).toBe(0);
    expect(effects.qualityBonusPercent).toBe(0);
    expect(effects.speedBonusPercent).toBe(0);
    expect(effects.riskReductionBonusPercent).toBe(0);
    for (const value of Object.values(effects)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      if (Array.isArray(value)) expect(value).toHaveLength(0);
    }
  });

  it('never produces NaN across all buildings and levels', () => {
    for (const definition of BUILDING_DEFINITIONS) {
    for (let level = 0; level <= definition.maxLevel; level++) {
      const building: AuxiliaryBuildingState = { id: definition.id, level, assignedEmployeeIds: [] };
      const effects = calculateBuildingWeeklyEffects([building], []);
        for (const value of Object.values(effects)) {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it('sums level effects, upkeep and staffed specialization effects', () => {
    const teacher = hire('teacher');
    teacher.assignedBuildingId = 'school';
    const effects = calculateBuildingWeeklyEffects(
      [schoolState({ level: 2, assignedEmployeeIds: [teacher.id] })],
      [teacher]
    );
    expect(effects.operationalBuildingIds).toEqual(['school']);
    expect(effects.employeeTrainingBonus).toBe(5);
    expect(effects.speedBonusPercent).toBe(15);
    expect(effects.buildingsUpkeep).toBe(200);
  });

  it('ignores unbuilt buildings', () => {
    const effects = calculateBuildingWeeklyEffects([schoolState({ level: 0 })], []);
    expect(effects.operationalBuildingIds).toEqual([]);
    expect(effects.buildingsUpkeep).toBe(0);
  });
});

describe('specialization matrix', () => {
  it('maps specializations to revenue, quality, speed and risk effects', () => {
    expect(specializationWeeklyEffects('auctioneer').venueRevenueBonusPercent).toBe(7);
    expect(specializationWeeklyEffects('clinician').qualityBonusPercent).toBe(8);
    expect(specializationWeeklyEffects('teacher').speedBonusPercent).toBe(5);
    expect(specializationWeeklyEffects('escort').riskReductionBonusPercent).toBe(6);
  });

  it('returns zeros for an unknown specialty', () => {
    expect(specializationWeeklyEffects('no_such_role' as EmployeeSpecialty)).toEqual({
      venueRevenueBonusPercent: 0,
      qualityBonusPercent: 0,
      speedBonusPercent: 0,
      riskReductionBonusPercent: 0
    });
  });
});

describe('checkPostCompatibility', () => {
  it('accepts a matching specialty for a required post', () => {
    expect(checkPostCompatibility(hire('teacher'), schoolState(), 0).compatible).toBe(true);
  });

  it('rejects the wrong specialty with a reason', () => {
    const result = checkPostCompatibility(hire('guard'), schoolState(), 0);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('Преподавание');
  });

  it('enforces the gender lock of госпожа/мастер posts', () => {
    const bdsm: AuxiliaryBuildingState = { id: 'bdsm_room', level: 1, assignedEmployeeIds: [] };
    expect(checkPostCompatibility(hire('mistress', 'women'), bdsm, 0).compatible).toBe(true);
    expect(checkPostCompatibility(hire('master', 'men'), bdsm, 0).compatible).toBe(true);
    expect(checkPostCompatibility(hire('mistress', 'men'), bdsm, 0).compatible).toBe(false);
    expect(checkPostCompatibility(hire('master', 'women'), bdsm, 0).compatible).toBe(false);
  });
});
