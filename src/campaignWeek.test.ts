import { describe, expect, it } from 'vitest';
import { advanceCampaignWeek, type WeeklyDeps } from './campaignWeek';
import { createInitialCampaign } from './saveState';
import type { AuxiliaryBuildingState } from './expansionTypes';
import { makeHiredEmployee } from './employeesEngine';

function makeDeps(overrides: Partial<WeeklyDeps> = {}): WeeklyDeps {
  return {
    showNotify: () => {},
    pushHospitalNotice: () => {},
    offDutyExhaustionRecovery: 8,
    queuedRaids: 0,
    maxQueuedRaids: 3,
    hospitalLevel: 0,
    hospitalStaff: { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 },
    hospitalPsychologistsOnDuty: [],
    gameRecords: { campaignsCompleted: 0, campaignsWon: 0, bestWeek: 0 } as WeeklyDeps['gameRecords'],
    leaderboard: [],
    ...overrides
  };
}

describe('advanceCampaignWeek', () => {
  it('advances exactly one week from the saved week', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps());

    expect(result.nextState).not.toBe(campaign);
    expect(result.nextState.week).toBe(campaign.week + 1);
    expect(result.weekNumber).toBe(campaign.week + 1);
    expect(result.notify).toContain(String(campaign.week + 1));
    expect(result.nextState.lastWeeklyReport?.week).toBe(campaign.week + 1);
  });

  it('reports the meta progress and the records it produced', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps());

    expect(result.nextState.metaProgress.stats.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(result.gameRecords.bestWeek).toBeGreaterThanOrEqual(campaign.week + 1);
    expect(result.campaignEnded).toBe(false);
    expect(result.ending).toBeNull();
  });

  it('never rolls ambushes while the caller reports a full queue', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps({ queuedRaids: 3, maxQueuedRaids: 3 }));
    expect(result.pendingRaids).toHaveLength(0);
  });

  it('keeps the save shape: the next state still migrates', async () => {
    const { migrateCampaignState } = await import('./saveState');
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps());
    const roundTripped = migrateCampaignState(JSON.parse(JSON.stringify(result.nextState)));

    expect(roundTripped.week).toBe(result.nextState.week);
    expect(roundTripped.funds).toBe(result.nextState.funds);
    expect(roundTripped.mezzanine.offset).toEqual(result.nextState.mezzanine.offset);
  });

  it('applies building upkeep and keeps every weekly figure finite', () => {
    const teacher = makeHiredEmployee(
      { id: 'emp_teacher', name: 'Учитель Тест', specialty: 'teacher', gender: 'women', skill: 50, experience: 0, morale: 80, weeklyWage: 1000 },
      1
    );
    teacher.assignedBuildingId = 'school';
    const campaign = {
      ...createInitialCampaign({ fresh: true, funds: 500000 }),
      employees: [teacher],
      auxiliaryBuildings: createInitialCampaign({ fresh: true }).auxiliaryBuildings.map(building =>
        building.id === 'school' ? { ...building, level: 1, assignedEmployeeIds: [teacher.id] } : building
      )
    };
    const result = advanceCampaignWeek(campaign, makeDeps());
    const report = result.nextState.lastWeeklyReport!;
    expect(Number.isFinite(result.netIncome)).toBe(true);
    expect(Number.isFinite(report.netIncome)).toBe(true);
    expect(Number.isFinite(report.treasuryAfter)).toBe(true);
    expect(report.expenses.buildings).toBe(100);
    expect(result.nextState.funds).toBe(campaign.funds + result.netIncome);
    for (const value of Object.values(report.revenue)) expect(Number.isFinite(value)).toBe(true);
    for (const value of Object.values(report.expenses)) expect(Number.isFinite(value)).toBe(true);
  });

  it('completes a timed building upgrade over weekly ticks', () => {
    const campaign = {
      ...createInitialCampaign({ fresh: true }),
      auxiliaryBuildings: ([
        { id: 'school', level: 0, upgradeWeeksRemaining: 2, upgradeTargetLevel: 1, assignedEmployeeIds: [] }
      ] as AuxiliaryBuildingState[])
    };
    const first = advanceCampaignWeek(campaign, makeDeps());
    expect(first.nextState.auxiliaryBuildings.find(building => building.id === 'school')!.level).toBe(0);
    expect(first.nextState.auxiliaryBuildings.find(building => building.id === 'school')!.upgradeWeeksRemaining).toBe(1);
    const second = advanceCampaignWeek(first.nextState, makeDeps());
    const school = second.nextState.auxiliaryBuildings.find(building => building.id === 'school')!;
    expect(school.level).toBe(1);
    expect(school.upgradeWeeksRemaining).toBe(0);
    expect(second.logs.some(line => line.includes('улучшено'))).toBe(true);
  });
});
