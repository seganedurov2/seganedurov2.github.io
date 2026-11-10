import { describe, expect, it } from 'vitest';
import {
  AUCTION_HOUSE_ADMINISTRATOR,
  AUCTION_INSPECTION_BALANCE,
  AUCTION_PROGRESSION_BALANCE,
  buildValuationAnnouncements,
  cancelCharacterSaleConsent,
  countCounterfeitLots,
  countProgressionItems,
  createEmptyAuctionHouse,
  createProgressionLot,
  getLotInspection,
  hasPendingSaleConsent,
  inspectAuctionLot,
  isProgressionLot,
  normalizeAuctionHouseState,
  NPC_AUCTION_BIDDERS,
  quoteAuctionLot,
  requestCharacterSaleConsent,
  sellAuctionLot,
  sellCounterfeitsBulk,
  sellProgressionLot,
  shouldSpawnProgressionItem,
  simulateNpcBidding,
  type AuctionGoodsLot,
  type AuctionHouseStaff,
  valuationMismatch
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

describe('auctionHouseEngine (NPC bidding / sales)', () => {
  const goodsLot1 = goodsLot({ id: 'npc1', appraisedValue: 10000 });

  it('simulateNpcBidding: reputation raises NPC participation rate', () => {
    const lowRep = simulateNpcBidding(goodsLot1, 10000, 1, 0, () => 0.5);
    const highRep = simulateNpcBidding(goodsLot1, 10000, 1, 100, () => 0.5);
    expect(highRep.npcBidCount).toBeGreaterThanOrEqual(lowRep.npcBidCount);
    expect(highRep.npcInterest).toHaveLength(NPC_AUCTION_BIDDERS.filter(b => b.interest === 'goods' || b.interest === 'all').length);
  });

  it('simulateNpcBidding: higher auction house level raises bids', () => {
    const lowLevel = simulateNpcBidding(goodsLot1, 10000, 1, 50, () => 0.5);
    const highLevel = simulateNpcBidding(goodsLot1, 10000, 5, 50, () => 0.5);
    expect(highLevel.finalProceeds).toBeGreaterThanOrEqual(lowLevel.finalProceeds);
  });

  it('simulateNpcBidding: revealed counterfeit draws no NPC bids', () => {
    const counterfeit = goodsLot({ id: 'cf1', authenticity: 'counterfeit', revealedAuthenticity: true, appraisedValue: 10000 });
    const res = simulateNpcBidding(counterfeit, 10000, 3, 50, () => 0);
    expect(res.npcBidCount).toBe(0);
    expect(res.finalProceeds).toBe(10000);
  });

  it('sellAuctionLot: NPC winner exceeds base proceeds and names the bidder', () => {
    const state = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'npcwin', appraisedValue: 10000 })] };
    // random=0.1 -> all bidders participate; variance=0.7; aggression-driven bids exceed base
    const result = sellAuctionLot(state, 'npcwin', 6, null, 0, 3, 80, () => 0.1);
    expect(result.sale).not.toBeNull();
    expect(result.sale!.saleProceeds).toBeGreaterThanOrEqual(10000);
    expect(result.sale!.winningNpcBidder).toBeTruthy();
  });

  it('sellAuctionLot: reveals counterfeit applies penalty and no scandal', () => {
    const state = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'cf2', authenticity: 'counterfeit', revealedAuthenticity: true, appraisedValue: 10000 })] };
    const result = sellAuctionLot(state, 'cf2', 6, null, 0, 0, 0, () => 0);
    expect(result.sale!.saleProceeds).toBe(Math.round(10000 * AUCTION_INSPECTION_BALANCE.counterfeitSalePenaltyPct));
    expect(result.sale!.revealedCounterfeit).toBe(true);
    expect(result.scandal).toBeUndefined();
    expect(result.state.pendingLots).toHaveLength(0);
  });

  it('sellAuctionLot: undisclosed counterfeit triggers scandal and funds loss', () => {
    const state = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'cf3', authenticity: 'counterfeit', revealedAuthenticity: false, appraisedValue: 10000 })] };
    const result = sellAuctionLot(state, 'cf3', 6, null, 0, 0, 0, () => 0);
    expect(result.scandal).toMatch(/поддел/);
    expect(result.reputationDelta).toBe(-AUCTION_INSPECTION_BALANCE.undisclosedScandalReputation);
    expect(result.fundsDelta).toBeLessThan(0);
  });

  it('sellAuctionLot: stale lot id is a no-op', () => {
    const result = sellAuctionLot(createEmptyAuctionHouse(), 'does-not-exist', 6);
    expect(result.sale).toBeNull();
    expect(result.state).toEqual(createEmptyAuctionHouse());
  });
});

describe('auctionHouseEngine (consent flow)', () => {
  const characterLot: AuctionGoodsLot & { characterId: string; isSlave: boolean } = {
    id: 'char1',
    productName: 'Имя персонажа',
    category: 'Раб' as const,
    characterId: 'ch1',
    gender: 'women' as const,
    assignedVenue: 'unassigned',
    isSlave: true,
    appraisedBy: 'Автоматическая оценка',
    appraisedValue: 5000,
    authenticity: 'genuine',
    revealedAuthenticity: false
  } as any;
  const state = { ...createEmptyAuctionHouse(), pendingLots: [characterLot] };

  it('request/cancel/hasPendingSaleConsent lifecycle', () => {
    expect(hasPendingSaleConsent(state, 'char1')).toBe(false);
    const afterRequest = requestCharacterSaleConsent(state, 'char1', 6);
    expect(hasPendingSaleConsent(afterRequest, 'char1')).toBe(true);
    const request = afterRequest.pendingSaleConsents[0];
    expect(request.lotId).toBe('char1');
    expect(request.lotName).toBe('Имя персонажа');
    expect(request.characterId).toBe('ch1');
    expect(request.isSlave).toBe(true);
    expect(request.appraisedValue).toBe(5000);
    expect(request.administratorName).toBe(AUCTION_HOUSE_ADMINISTRATOR);

    // duplicate request is a no-op
    const again = requestCharacterSaleConsent(afterRequest, 'char1', 7);
    expect(again.pendingSaleConsents).toHaveLength(1);

    const afterCancel = cancelCharacterSaleConsent(afterRequest, 'char1');
    expect(hasPendingSaleConsent(afterCancel, 'char1')).toBe(false);
    expect(afterCancel.pendingSaleConsents).toHaveLength(0);
  });

  it('cancelCharacterSaleConsent for unknown lot is a no-op', () => {
    const after = cancelCharacterSaleConsent(state, 'nope');
    expect(after.pendingSaleConsents).toHaveLength(0);
  });
});

describe('auctionHouseEngine (valuation / NaN protection)', () => {
  it('valuationMismatch detects whole-dollar divergence and is NaN-safe', () => {
    expect(valuationMismatch(1000, 1000)).toBe(false);
    expect(valuationMismatch(1000, 1001)).toBe(true);
    expect(valuationMismatch(0, 1)).toBe(true);
    expect(valuationMismatch(NaN as unknown as number, 1000)).toBe(false);
    expect(valuationMismatch(1000, NaN as unknown as number)).toBe(false);
  });

  it('quoteAuctionLot guards against NaN and negative appraised value', () => {
    const nanLot = { ...goodsLot({ id: 'nan1' }), appraisedValue: NaN as unknown as number };
    const quote = quoteAuctionLot(nanLot, null, 0);
    expect(quote.appraisedValue).toBe(0);
    expect(quote.saleProceeds).toBe(0);

    const negLot = { ...goodsLot({ id: 'neg1' }), appraisedValue: -500 };
    const negQuote = quoteAuctionLot(negLot, null, 0);
    expect(negQuote.appraisedValue).toBe(0);
    expect(negQuote.saleProceeds).toBe(0);
  });

  it('buildValuationAnnouncements returns appraiser + auctioneer messages', () => {
    const announcements = buildValuationAnnouncements(goodsLot({ id: 'ann1', appraisedValue: 5000 }), 8000, null, null, 0, true);
    expect(announcements).toHaveLength(2);
    expect(announcements[0].speaker).toBe('appraiser');
    expect(announcements[1].speaker).toBe('auctioneer');
    expect(announcements[1].text).toContain('Продажа подтверждена.');
  });
});

