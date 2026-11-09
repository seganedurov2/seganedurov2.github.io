import { describe, expect, it } from 'vitest';
import {
  AUCTION_INSPECTION_BALANCE,
  AUCTION_PROGRESSION_BALANCE,
  countCounterfeitLots,
  countProgressionItems,
  createEmptyAuctionHouse,
  createProgressionLot,
  getLotInspection,
  inspectAuctionLot,
  isProgressionLot,
  normalizeAuctionHouseState,
  sellAuctionLot,
  sellCounterfeitsBulk,
  sellProgressionLot,
  shouldSpawnProgressionItem,
  type AuctionGoodsLot,
  type AuctionHouseStaff
} from './auctionHouseEngine';
import { PLEASURE_HOUSE_UPGRADES } from './pleasureHouseEngine';

const goodsLot = (overrides: Partial<AuctionGoodsLot> = {}): AuctionGoodsLot => ({
  id: 'g1',
  productName: 'Шёлк',
  category: 'Текстиль',
  quantity: 2,
  caravanId: 'c1',
  caravanName: 'Караван',
  arrivalWeek: 3,
  appraisedBy: 'Оценщик',
  appraisedValue: 1000,
  authenticity: 'genuine',
  revealedAuthenticity: false,
  ...overrides
});

const staff: AuctionHouseStaff = { auctioneer: null, appraiser: null, buildingLevel: 0 };
const appraiserStaff: AuctionHouseStaff = {
  auctioneer: null,
  appraiser: { id: 'a1', name: 'Оценщик', specialty: 'appraiser', status: 'active', weeklyWage: 0, morale: 100, skill: 50, assignedBuildingId: 'auction_house' } as never,
  buildingLevel: 1
};

describe('auctionHouseEngine (inspect/counterfeit/junkyard)', () => {
  it('normalizes legacy saves with defaults', () => {
    const state = normalizeAuctionHouseState({ pendingLots: [], recentSales: [], pendingSaleConsents: [] });
    expect(state.inspections).toEqual([]);
    expect(state.inspectWeek).toBe(1);
    expect(state.inspectChargesUsed).toBe(0);
  });

  it('limits free inspections without appraiser and reveals counterfeit with appraiser', () => {
    let state: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'x', authenticity: 'counterfeit' })], inspectWeek: 5, inspectChargesUsed: 0 };
    for (let i = 0; i < AUCTION_INSPECTION_BALANCE.freeChargesPerWeek; i++) {
      const r = inspectAuctionLot(state, 'x', 5, staff, () => 0.9);
      state = r.state;
      expect(r.inspection).toBeTruthy();
    }
    const blocked = inspectAuctionLot(state, 'x', 5, staff, () => 0.9);
    expect(blocked.inspection).toBeNull();
    expect(blocked.reason).toMatch(/Лимит/);

    const withAppraiser: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'y', authenticity: 'counterfeit' })], inspectWeek: 5, inspectChargesUsed: 99 };
    const revealed = inspectAuctionLot(withAppraiser, 'y', 5, appraiserStaff, () => 0.9);
    expect(revealed.inspection?.verdict).toBe('counterfeit');
    expect(getLotInspection(revealed.state, 'y')?.revealedCounterfeit).toBe(true);
    expect(revealed.state.pendingLots[0]?.revealedAuthenticity).toBe(true);
  });

  it('penalizes revealed counterfeit sale and creates scandal for undisclosed counterfeit', () => {
    const revealedState: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ authenticity: 'counterfeit', revealedAuthenticity: true })] };
    const revealedSale = sellAuctionLot(revealedState, 'g1', 6, null, 0, 0, 0, () => 0);
    expect(revealedSale.sale?.saleProceeds).toBe(Math.round(1000 * AUCTION_INSPECTION_BALANCE.counterfeitSalePenaltyPct));
    expect(revealedSale.sale?.revealedCounterfeit).toBe(true);
    expect(revealedSale.scandal).toBeUndefined();

    const hiddenState: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ authenticity: 'counterfeit', revealedAuthenticity: false })] };
    const hiddenSale = sellAuctionLot(hiddenState, 'g1', 6, null, 0, 0, 0, () => 0);
    expect(hiddenSale.reputationDelta).toBe(-AUCTION_INSPECTION_BALANCE.undisclosedScandalReputation);
    expect(hiddenSale.fundsDelta).toBeLessThan(0);
    expect(hiddenSale.scandal).toMatch(/поддел/);
  });

  it('sells counterfeits in bulk via junkyard when threshold met', () => {
    const lots = Array.from({ length: AUCTION_INSPECTION_BALANCE.junkyardUnlockCount }, (_, i) =>
      goodsLot({ id: `c${i}`, authenticity: 'counterfeit', appraisedValue: 1000 })
    );
    const state: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: lots };
    expect(countCounterfeitLots(state)).toBe(AUCTION_INSPECTION_BALANCE.junkyardUnlockCount);
    const bulk = sellCounterfeitsBulk(state, 7);
    expect(bulk.count).toBe(AUCTION_INSPECTION_BALANCE.junkyardUnlockCount);
    expect(bulk.proceeds).toBe(Math.round(1000 * AUCTION_INSPECTION_BALANCE.junkyardBulkRate) * bulk.count);
    expect(bulk.state.pendingLots).toHaveLength(0);
    expect(bulk.state.recentSales[0]?.saleChannel).toBe('junkyard');
  });
});

describe('auctionHouseEngine (progression lots)', () => {
  const caravan = { id: 'car1', name: 'Караван №1' } as never;

  const progressionState = (lot: ReturnType<typeof createProgressionLot>) =>
    ({ ...createEmptyAuctionHouse(), pendingLots: [lot] }) as ReturnType<typeof createEmptyAuctionHouse>;

  it('spawns a progression item only on a matching roll', () => {
    expect(shouldSpawnProgressionItem(() => 0)).toBe(true);
    expect(shouldSpawnProgressionItem(() => 0.11)).toBe(true);
    expect(shouldSpawnProgressionItem(() => AUCTION_PROGRESSION_BALANCE.arrivalChance)).toBe(false);
    expect(shouldSpawnProgressionItem(() => 0.99)).toBe(false);
  });

  it('creates a fixed-price progression lot bound to a pleasure-house track', () => {
    const lot = createProgressionLot(caravan, 7, 'bdsm_services', () => 0.5);
    expect(lot.category).toBe('Прогрессия');
    expect(lot.targetTrack).toBe('bdsm_services');
    expect(lot.trackName).toBe(PLEASURE_HOUSE_UPGRADES.bdsm_services.name);
    expect(lot.arrivalWeek).toBe(7);
    expect(lot.authenticity).toBe('genuine');
    expect(lot.appraisedValue).toBeGreaterThanOrEqual(AUCTION_PROGRESSION_BALANCE.minPrice);
    expect(lot.appraisedValue).toBeLessThan(AUCTION_PROGRESSION_BALANCE.maxPrice);
    expect(isProgressionLot(lot)).toBe(true);
    // Обычный товарный лот предметом прогрессии не считается.
    expect(isProgressionLot(goodsLot())).toBe(false);
  });

  it('sells a progression lot at its appraised value without NPC bidding or scandal', () => {
    const lot = createProgressionLot(caravan, 3, 'room_upgrades', () => 0.25);
    const sale = sellAuctionLot(progressionState(lot), lot.id, 9, null, 0, 0, 0, () => 0.99);
    expect(sale.sale?.saleProceeds).toBe(lot.appraisedValue);
    expect(sale.sale?.auctioneerBonusPercent).toBe(0);
    expect(sale.sale?.winningNpcBidder).toBeUndefined();
    // У продажи прогрессии нет скандала, поэтому и дельт нет — поля не заполняются.
    expect(sale.reputationDelta ?? 0).toBe(0);
    expect(sale.fundsDelta ?? 0).toBe(0);
    expect(sale.scandal).toBeUndefined();
    expect(sale.state.pendingLots).toHaveLength(0);
    expect(sale.state.recentSales[0]?.id).toBe(lot.id);
  });

  it('dedicated seller and general seller agree, and stale ids are a no-op', () => {
    const lot = createProgressionLot(caravan, 4, 'alcohol_service', () => 0.4);
    const dedicated = sellProgressionLot(progressionState(lot), lot.id, 4);
    const general = sellAuctionLot(progressionState(lot), lot.id, 4);
    expect(dedicated.sale?.saleProceeds).toBe(general.sale?.saleProceeds);
    expect(countProgressionItems(progressionState(lot))).toBe(1);
    expect(countProgressionItems(createEmptyAuctionHouse())).toBe(0);
    const stale = sellAuctionLot(createEmptyAuctionHouse(), lot.id, 4);
    expect(stale.sale).toBeNull();
  });

  it('keeps progression lots through save normalization', () => {
    const lot = createProgressionLot(caravan, 5, 'fetish_services', () => 0.6);
    const state = normalizeAuctionHouseState({
      pendingLots: [lot],
      recentSales: [],
      pendingSaleConsents: []
    });
    const restored = state.pendingLots[0];
    expect(restored && isProgressionLot(restored)).toBe(true);
    expect(restored).toMatchObject({
      id: lot.id,
      category: 'Прогрессия',
      targetTrack: 'fetish_services',
      appraisedValue: lot.appraisedValue,
      arrivalWeek: 5
    });
  });
});
