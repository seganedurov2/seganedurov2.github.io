import { describe, expect, it } from 'vitest';
import { generateCity, placeBuilding } from './cityBuilder';
import { serializeCityPlan } from './cityPlanState';
import { createInitialCampaign, migrateCampaignState } from './saveState';
import { createDefaultMezzanineView } from './mezzanineViewState';

describe('saveState meta-progress migration', () => {
  it('creates a campaign with meta progress and an empty report history', () => {
    const campaign = createInitialCampaign({ fresh: true });
    expect(campaign.version).toBe(5);
    expect(campaign.cityPlan).toBeNull();
    expect(campaign.metaProgress).toBeDefined();
    expect(campaign.metaProgress.goalStatus).toBe('ongoing');
    expect(campaign.metaProgress.prestige.level).toBe(0);
    expect(campaign.weeklyReports).toEqual([]);
    expect(campaign.lastWeeklyReport).toBeNull();
  });

  it('migrates a legacy lastWeeklyReport into the history', () => {
    const legacy = {
      ...createInitialCampaign({ fresh: true }),
      lastWeeklyReport: {
        week: 13,
        revenue: { venue: 100, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
        expenses: { wages: 50, hospital: 0, restZone: 0, staffSlots: 0, loanPayment: 0 },
        netIncome: 50,
        treasuryAfter: 125050
      }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.weeklyReports).toHaveLength(1);
    expect(migrated.weeklyReports[0].week).toBe(13);
    expect(migrated.lastWeeklyReport?.week).toBe(13);
    expect(migrated.lastWeeklyReport?.expenses.warehouse).toBe(0);
  });

  it('keeps an existing report history and drops invalid entries', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const withHistory = {
      ...campaign,
      weeklyReports: [
        {
          week: 1,
          revenue: { venue: 10, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
          expenses: { wages: 5, hospital: 0, restZone: 0, staffSlots: 0, loanPayment: 0, warehouse: 25 },
          netIncome: 5,
          treasuryAfter: 125005
        },
        'garbage',
        {
          week: 2,
          revenue: { venue: 20, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
          expenses: { wages: 5, hospital: 0, restZone: 0, staffSlots: 0, loanPayment: 0 },
          netIncome: 15,
          treasuryAfter: 125020
        }
      ]
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(withHistory)));
    expect(migrated.weeklyReports).toHaveLength(2);
    expect(migrated.weeklyReports.map(report => report.week)).toEqual([1, 2]);
    expect(migrated.weeklyReports[0].expenses.warehouse).toBe(25);
    expect(migrated.weeklyReports[1].expenses.warehouse).toBe(0);
  });

  it('normalizes partial meta progress from older saves', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const withPartialMeta = {
      ...campaign,
      metaProgress: {
        achievements: { week_10: 10, unknown_achievement: 3 },
        stats: { totalRevenue: 5000, peakFunds: 9999 },
        prestige: { level: 2, victories: 1 },
        goalStatus: 'victory',
        endingWeek: 100
      }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(withPartialMeta)));
    expect(migrated.metaProgress.achievements).toEqual({ week_10: 10 });
    expect(migrated.metaProgress.stats.totalRevenue).toBe(5000);
    expect(migrated.metaProgress.stats.peakFunds).toBe(9999);
    expect(migrated.metaProgress.stats.auctionsCompleted).toBe(0);
    expect(migrated.metaProgress.prestige).toEqual({ level: 2, victories: 1, progressionPoints: 0 });
    expect(migrated.metaProgress.goalStatus).toBe('victory');
    expect(migrated.metaProgress.endingWeek).toBe(100);
  });

  it('keeps regional market state and repairs broken demand/standing maps (0.6.5)', () => {
    const campaign = createInitialCampaign({ fresh: true });
    // Новая кампания: спрос и влияние есть для всех регионов рынка.
    expect(campaign.marketDemand['05_middle_east']).toBe(1.4);
    expect(campaign.regionalStanding['07_west_africa']).toBe(50);

    const legacy = {
      ...campaign,
      marketDemand: { '01_north_america': 1.7, '03_western_europe': Number.NaN, '99_unknown': 1.3 },
      regionalStanding: { '01_north_america': 64, '02_south_america': 'broken' }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    // NaN и мусор выпадают, известный регион сохраняется.
    expect(migrated.marketDemand).toEqual({ '01_north_america': 1.7, '99_unknown': 1.3 });
    expect(migrated.regionalStanding).toEqual({ '01_north_america': 64 });

    // Сейв без поля вообще — пустые словари, без ошибок.
    const withoutFields = { ...campaign } as Record<string, unknown>;
    delete withoutFields.marketDemand;
    delete withoutFields.regionalStanding;
    const bare = migrateCampaignState(JSON.parse(JSON.stringify(withoutFields)));
    expect(bare.marketDemand).toEqual({});
    expect(bare.regionalStanding).toEqual({});
  });

  it('starts a new campaign with an empty mezzanine view', () => {
    const campaign = createInitialCampaign({ fresh: true });
    expect(campaign.mezzanine).toEqual({
      selectedRegionId: null,
      selectedCity: null,
      viewMode: 'region',
      gridSize: 64,
      offset: { x: 0, y: 0 },
      citySeed: 1101
    });
  });

  it('restores the mezzanine view saved in 0.3.7', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const withView = {
      ...campaign,
      mezzanine: {
        selectedRegionId: 'gomel',
        selectedCity: { name: 'Калинковичи', lat: 52.1288, lon: 29.3325, seed: 1101 },
        viewMode: 'city',
        gridSize: 48,
        offset: { x: 0, y: 0 },
        citySeed: 1101
      }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(withView)));
    expect(migrated.mezzanine.viewMode).toBe('city');
    expect(migrated.mezzanine.selectedRegionId).toBe('gomel');
    expect(migrated.mezzanine.selectedCity?.name).toBe('Калинковичи');
    expect(migrated.mezzanine.gridSize).toBe(48);
  });

  it('loads pre-0.3.7 saves that have no mezzanine block', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const { mezzanine: _mezzanine, ...legacy } = campaign;
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.mezzanine).toEqual(createDefaultMezzanineView());
  });

  it('repairs a corrupted mezzanine block instead of dropping the campaign', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      mezzanine: { viewMode: 'city', gridSize: 5000, selectedCity: { name: 'X', lat: 0, lon: 0, seed: 0 } }
    });
    expect(migrated.mezzanine.gridSize).toBe(200);
    expect(migrated.mezzanine.selectedCity?.seed).toBe(1);
    expect(migrated.mezzanine.viewMode).toBe('city');
  });

  it('migrates a v4 save without a city plan to an empty v5 plan', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const { cityPlan: _cityPlan, ...legacy } = campaign;
    const migrated = migrateCampaignState({ ...JSON.parse(JSON.stringify(legacy)), version: 4 });

    expect(migrated.version).toBe(5);
    expect(migrated.cityPlan).toBeNull();
    expect(migrated.funds).toBe(campaign.funds);
    expect(migrated.roster).toHaveLength(campaign.roster.length);
  });

  it('round-trips a valid city plan through campaign migration', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const city = generateCity(1101);
    let point: { x: number; y: number } | null = null;
    for (let y = 0; y < city.size && !point; y++) {
      for (let x = 0; x < city.size; x++) {
        if (city.cells[y][x].type === 'lot') {
          point = { x, y };
          break;
        }
      }
    }
    expect(point).not.toBeNull();
    placeBuilding(city, point!.x, point!.y, 'office', 1000);
    const cityPlan = serializeCityPlan(city, 1101, { savedAt: 2000, wasOpenAtSave: true });
    const migrated = migrateCampaignState({ ...JSON.parse(JSON.stringify(campaign)), cityPlan });

    expect(migrated.cityPlan).toEqual(cityPlan);
    expect(migrated.version).toBe(5);
  });

  it('drops a corrupt city plan without losing the campaign', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      cityPlan: { schemaVersion: 99, seed: -1, buildings: 'bad' }
    });

    expect(migrated.cityPlan).toBeNull();
    expect(migrated.funds).toBe(campaign.funds);
    expect(migrated.roster).toHaveLength(campaign.roster.length);
  });

  it('starts a new campaign with an empty city economy and a closed hub', () => {
    const campaign = createInitialCampaign({ fresh: true });
    expect(campaign.cityEconomy).toEqual({ schemaVersion: 1, lastReport: null });
    expect(campaign.cityHubOpenedAt).toBeNull();
  });

  it('round-trips the last city economy report', () => {
    const campaign = createInitialCampaign({ fresh: true, week: 20 });
    const report = {
      week: 20,
      residents: 16,
      jobs: 60,
      filledJobs: 16,
      occupancy: 16 / 60,
      built: 3,
      parks: 0,
      unemployed: 0,
      income: { employmentTax: 96, parks: 0 },
      expenses: { upkeep: 54, unemployment: 0 },
      surplus: 42,
      started: ['house' as const],
      constructionSpend: 120,
      log: ['Город принёс 96 AX муниципального дохода.'],
    };
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      cityEconomy: { schemaVersion: 1, lastReport: report },
    });

    expect(migrated.cityEconomy.lastReport).toEqual(report);
  });

  it('drops a corrupt city economy block without losing the campaign', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      cityEconomy: { schemaVersion: 1, lastReport: { week: 3, income: 'x', expenses: null, occupancy: 7, surplus: 'NaN' } },
    });

    const report = migrated.cityEconomy.lastReport;
    expect(report).not.toBeNull();
    expect(report?.occupancy).toBe(1);
    expect(report?.surplus).toBe(0);
    expect(report?.income).toEqual({ employmentTax: 0, parks: 0 });
    expect(report?.expenses).toEqual({ upkeep: 0, unemployment: 0 });
    expect(migrated.funds).toBe(campaign.funds);
  });

  it('loads pre-0.4.1 saves without a city economy block', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const { cityEconomy: _cityEconomy, cityHubOpenedAt: _opened, ...legacy } = campaign;
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));

    expect(migrated.cityEconomy).toEqual({ schemaVersion: 1, lastReport: null });
    expect(migrated.cityHubOpenedAt).toBeNull();
  });

  it('normalizes broken slave contracts and buyer standings (0.6.6)', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const broken = {
      ...JSON.parse(JSON.stringify(campaign)),
      slaveContracts: [
        {
          id: 'sc_old',
          channel: 'market',
          buyerType: 'Частное имение',
          title: 'Old',
          description: '',
          regionId: '03_western_europe',
          regionName: 'Western Europe',
          quantityWanted: '3',
          quantityDelivered: 99,
          minQuality: 'legendary',
          pricePerHead: 'not-a-number',
          demandTier: 'bad',
          rewardReputation: 2,
          riskReputation: 3,
          riskPercent: 999,
          weeksRemaining: -5,
          status: 'active'
        },
        null,
        'garbage'
      ],
      buyerStandings: {
        'Частное имение': { buyerType: 'Частное имение', reputation: 99, scandals: -2, lockedUntilWeek: '7' },
        broken: 'x'
      },
      tradeSupplyContracts: [
        { id: 'ts1', regionId: 'x', regionName: 'X', quality: 'legendary', weeklyQuantity: 0, pricePerHead: NaN }
      ]
    };
    const migrated = migrateCampaignState(broken);
    expect(migrated.slaveContracts).toHaveLength(1);
    const sc = migrated.slaveContracts[0];
    expect(sc.quantityWanted).toBe(3);
    expect(sc.quantityDelivered).toBe(3); // clamped to wanted
    expect(sc.pricePerHead).toBe(5000); // fallback
    expect(sc.demandTier).toBe('medium');
    expect(sc.riskPercent).toBe(100);
    expect(sc.weeksRemaining).toBe(0);
    expect(sc.status).toBe('completed');
    expect(sc.minQuality).toBe('legendary');
    expect(migrated.buyerStandings['Частное имение'].reputation).toBe(10);
    expect(migrated.buyerStandings['Частное имение'].scandals).toBe(0);
    expect(migrated.buyerStandings['Частное имение'].lockedUntilWeek).toBe(7);
    expect(migrated.tradeSupplyContracts).toHaveLength(1);
    expect(migrated.tradeSupplyContracts[0].quality).toBe('legendary');
    expect(migrated.tradeSupplyContracts[0].weeklyQuantity).toBe(1);
    expect(migrated.tradeSupplyContracts[0].supplyRiskPercent).toBeUndefined();
    expect(migrated.tradeSupplyContracts[0].lastRiskReason).toBeUndefined();
  });

  it('normalizes 0.6.6 supply risk fields without breaking old saves', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      tradeSupplyContracts: [{ id: 'ts2', regionId: 'x', regionName: 'X', quality: 'high', weeklyQuantity: 2, pricePerHead: 1000, supplyRiskPercent: 999, lastRiskReason: 'x'.repeat(500) }]
    });
    expect(migrated.tradeSupplyContracts[0].supplyRiskPercent).toBe(100);
    expect(migrated.tradeSupplyContracts[0].lastRiskReason?.length).toBe(240);
  });

  it('backfills the hub opening week for saves that already used the mezzanine', () => {
    const campaign = createInitialCampaign({ fresh: true, week: 44 });
    const { cityHubOpenedAt: _opened, ...legacy } = campaign;
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(legacy)),
      mezzanine: { ...createDefaultMezzanineView(), selectedRegionId: 'gomel' },
    });

    expect(migrated.cityHubOpenedAt).toBe(44);
  });

  it('keeps an explicit hub opening week', () => {
    const campaign = createInitialCampaign({ fresh: true, week: 44 });
    const migrated = migrateCampaignState({ ...JSON.parse(JSON.stringify(campaign)), cityHubOpenedAt: 12 });
    expect(migrated.cityHubOpenedAt).toBe(12);
  });

  it('starts every campaign in the act its week belongs to', () => {
    expect(createInitialCampaign({ fresh: true, week: 12 }).campaignScript)
      .toEqual({ actId: 'founding', enteredWeek: 1 });
    expect(createInitialCampaign({ fresh: true, week: 70 }).campaignScript)
      .toEqual({ actId: 'syndicate', enteredWeek: 61 });
  });

  it('loads pre-0.3.7 saves without a campaign script', () => {
    const campaign = createInitialCampaign({ fresh: true, week: 40 });
    const { campaignScript: _script, ...legacy } = campaign;
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.campaignScript).toEqual({ actId: 'expansion', enteredWeek: 31 });
  });

  it('moves a stale script to the act of the saved week', () => {
    const campaign = createInitialCampaign({ fresh: true, week: 90 });
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      campaignScript: { actId: 'founding', enteredWeek: 1 }
    });
    expect(migrated.campaignScript).toEqual({ actId: 'reckoning', enteredWeek: 86 });
  });

  it('falls back to defaults when meta progress is missing entirely', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const { metaProgress: _metaProgress, weeklyReports: _weeklyReports, ...legacy } = campaign;
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.metaProgress.goalStatus).toBe('ongoing');
    expect(migrated.metaProgress.prestige.level).toBe(0);
    expect(migrated.weeklyReports).toEqual([]);
  });

  it('normalizes auxiliary buildings with defaults and carries upgrade flags', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const legacy = {
      ...JSON.parse(JSON.stringify(campaign)),
      auxiliaryBuildings: [
        { id: 'school', level: 1, assignedEmployeeIds: [] },
        { id: 'hospital', level: 2, upgradeWeeksRemaining: 2, upgradeTargetLevel: 3, assignedEmployeeIds: [] }
      ]
    };
    const migrated = migrateCampaignState(legacy);
    const school = migrated.auxiliaryBuildings.find(building => building.id === 'school')!;
    expect(school.level).toBe(1);
    expect(school.upgradeWeeksRemaining).toBeUndefined();
    const hospital = migrated.auxiliaryBuildings.find(building => building.id === 'hospital')!;
    expect(hospital.level).toBe(2);
    expect(hospital.upgradeWeeksRemaining).toBe(2);
    expect(hospital.upgradeTargetLevel).toBe(3);
  });
});
