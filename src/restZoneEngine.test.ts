import { describe, expect, it } from 'vitest';
import {
  REST_PROGRAM,
  REST_ZONE_BASE_SEATS,
  REST_ZONE_TIERS,
  REST_SEAT_BASE_COST,
  REST_SEAT_UPKEEP,
  REST_ATTENDANT_SUBMISSION,
  createRestZoneState,
  restZoneCapacity,
  restZoneName,
  nextRestSeatCost,
  restZoneWeeklyUpkeep,
  quoteRestSeat,
  recommendedAttendantCount,
  activeAttendants,
  isAttendant,
  attendantSubmissionGain,
  restProgramCost,
  freeRestSlots,
  restingCharacterIds,
  findPlacement,
  restEligibility,
  admitToRest,
  advanceRestZoneWeek,
  normalizeRestZone
} from './restZoneEngine';
import type { Character } from './gameEngine';
import type { RestAttendant } from './restZoneEngine';

const character: Character = {
  id: 'char_1',
  name: 'Тестовый',
  gender: 'women',
  age: 25,
  exactHealth: 60,
  exactExhaustion: 80,
  loyalty: 50,
  region: 'region_1',
  assignedVenue: 'trade',
  exhaustionLevel: 'Exhausted',
  healthLevel: 'Fair',
  skinCondition: 'Clear',
  submission: 50
} as Character;

const attendant: RestAttendant = { id: 'att_1', name: 'Надзиратель', skill: 60 };

describe('restZoneEngine (defaults)', () => {
  it('createRestZoneState: base seats, no attendants, empty placements', () => {
    const state = createRestZoneState();
    expect(state.seats).toBe(REST_ZONE_BASE_SEATS);
    expect(state.attendantIds).toEqual([]);
    expect(state.placements).toEqual([]);
    expect(state.totalWeeksHosted).toBe(0);
    expect(state.totalSpent).toBe(0);
  });

  it('REST_PROGRAM: 4 weeks, fixed weekly cost and recovery values', () => {
    expect(REST_PROGRAM.weeks).toBe(4);
    expect(REST_PROGRAM.weeklyCost).toBe(1800);
    expect(REST_PROGRAM.exhaustionRecovery).toBe(22);
    expect(REST_PROGRAM.healthRecovery).toBe(9);
    expect(REST_PROGRAM.loyaltyRecovery).toBe(2);
    expect(REST_PROGRAM.submissionRecovery).toBe(1);
    expect(REST_PROGRAM.skinRecovery).toBe(true);
    expect(restProgramCost()).toBe(REST_PROGRAM.weeks * REST_PROGRAM.weeklyCost);
  });
});

describe('restZoneEngine (capacity / cost / upkeep)', () => {
  it('restZoneCapacity returns seats', () => {
    const state = createRestZoneState();
    expect(restZoneCapacity(state)).toBe(3);
    state.seats = 12;
    expect(restZoneCapacity(state)).toBe(12);
  });

  it('nextRestSeatCost: base price, grows with each extra seat', () => {
    const state = createRestZoneState();
    expect(nextRestSeatCost(state)).toBe(REST_SEAT_BASE_COST);
    state.seats = 4;
    const next = nextRestSeatCost(state);
    expect(next).toBeGreaterThan(REST_SEAT_BASE_COST);
    state.seats = 5;
    expect(nextRestSeatCost(state)).toBeGreaterThan(next);
  });

  it('restZoneWeeklyUpkeep scales with seats', () => {
    const state = createRestZoneState();
    expect(restZoneWeeklyUpkeep(state)).toBe(REST_ZONE_BASE_SEATS * REST_SEAT_UPKEEP);
    state.seats = 10;
    expect(restZoneWeeklyUpkeep(state)).toBe(10 * REST_SEAT_UPKEEP);
  });

  it('quoteRestSeat: affordable when funds cover cost', () => {
    const state = createRestZoneState();
    const affordable = quoteRestSeat(state, 100000);
    expect(affordable.affordable).toBe(true);
    expect(affordable.seatsAfter).toBe(state.seats + 1);
    const poor = quoteRestSeat(state, 0);
    expect(poor.affordable).toBe(false);
  });
});

describe('restZoneEngine (attendants)', () => {
  it('recommendedAttendantCount: ceil(seats / 4), minimum 1', () => {
    expect(recommendedAttendantCount(0)).toBe(1);
    expect(recommendedAttendantCount(3)).toBe(1);
    expect(recommendedAttendantCount(4)).toBe(1);
    expect(recommendedAttendantCount(5)).toBe(2);
    expect(recommendedAttendantCount(12)).toBe(3);
  });

  it('activeAttendants: only payroll attendants posted to zone', () => {
    const state = createRestZoneState();
    state.attendantIds = ['att_1', 'att_gone'];
    expect(activeAttendants(state, [attendant])).toHaveLength(1);
    expect(activeAttendants(state, [attendant])[0]?.id).toBe('att_1');
  });

  it('isAttendant: true when posted', () => {
    const state = createRestZoneState();
    state.attendantIds = ['att_1'];
    expect(isAttendant(state, 'att_1')).toBe(true);
    expect(isAttendant(state, 'att_2')).toBe(false);
  });

  it('attendantSubmissionGain: flat per attendant plus skill share', () => {
    const none = attendantSubmissionGain([]);
    expect(none).toBe(0);
    const one = attendantSubmissionGain([{ ...attendant, skill: 60 }]);
    expect(one).toBe(REST_ATTENDANT_SUBMISSION + Math.floor(60 / 50));
    const two = attendantSubmissionGain([{ ...attendant, skill: 60 }, { ...attendant, id: 'att_2', skill: 30 }]);
    expect(two).toBe(2 * REST_ATTENDANT_SUBMISSION + Math.floor(60 / 50) + Math.floor(30 / 50));
  });
});

describe('restZoneEngine (eligibility)', () => {
  const availability = { hospitalPatientIds: [], busyCharacterIds: [] };

  it('restEligibility: ineligible when in hospital', () => {
    const res = restEligibility(character, createRestZoneState(), { ...availability, hospitalPatientIds: ['char_1'] });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('больнице');
  });

  it('restEligibility: ineligible when busy in the field', () => {
    const res = restEligibility(character, createRestZoneState(), { ...availability, busyCharacterIds: ['char_1'] });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('поле');
  });

  it('restEligibility: ineligible when already resting', () => {
    const state = createRestZoneState();
    state.placements.push({ ...admitToRest(character, 1), weeksRemaining: 2 });
    const res = restEligibility(character, state, availability);
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('уже на отдыхе');
  });

  it('restEligibility: ineligible when hospitalized pregnancy', () => {
    const preg = { ...character, pregnancy: { status: 'hospitalized', daysPregnant: 100, hospitalWeeksRemaining: 1 } } as Character;
    const res = restEligibility(preg, createRestZoneState(), availability);
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('родовом');
  });

  it('restEligibility: ineligible when stable', () => {
    const stable = { ...character, exhaustionLevel: 'Rested', exactExhaustion: 10, healthLevel: 'Good', skinCondition: 'Flawless' } as Character;
    const res = restEligibility(stable, createRestZoneState(), availability);
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('хорошо');
  });

  it('restEligibility: ineligible when no free slots', () => {
    const state = createRestZoneState();
    state.seats = 3;
    state.placements = [1, 2, 3].map((_, i) => admitToRest({ ...character, id: `c${i}` } as Character, 1));
    const res = restEligibility(character, state, availability);
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('нет свободных мест');
  });

  it('restEligibility: eligible when needs care and slot is free', () => {
    const res = restEligibility(character, createRestZoneState(), availability);
    expect(res.eligible).toBe(true);
    expect(res.reason).toBe('');
  });
});

describe('restZoneEngine (placements / admission)', () => {
  it('admitToRest: creates placement with program values', () => {
    const placement = admitToRest(character, 5);
    expect(placement.characterId).toBe('char_1');
    expect(placement.characterName).toBe('Тестовый');
    expect(placement.programName).toBe(REST_PROGRAM.name);
    expect(placement.weeksTotal).toBe(REST_PROGRAM.weeks);
    expect(placement.weeksRemaining).toBe(REST_PROGRAM.weeks);
    expect(placement.admittedWeek).toBe(5);
    expect(placement.returnVenue).toBe('trade');
  });

  it('freeRestSlots / restingCharacterIds / findPlacement', () => {
    const state = createRestZoneState();
    expect(freeRestSlots(state)).toBe(3);
    expect(restingCharacterIds(state)).toEqual([]);
    expect(findPlacement(state, 'char_1')).toBeUndefined();

    const placement = admitToRest(character, 1);
    state.placements.push(placement);
    expect(freeRestSlots(state)).toBe(2);
    expect(restingCharacterIds(state)).toContain('char_1');
    expect(findPlacement(state, 'char_1')).toBe(placement);
  });
});

describe('restZoneEngine (week advance)', () => {
  it('advanceRestZoneWeek: recovers health/exhaustion, discharges at end', () => {
    const state = createRestZoneState();
    const placement = admitToRest(character, 1);
    state.placements = [placement];
    const result = advanceRestZoneWeek(state, [character], [], { hospitalPatientIds: [], busyCharacterIds: [] }, 1);

    const rested = result.roster[0];
    expect(rested.exactExhaustion).toBe(Math.max(0, character.exactExhaustion - REST_PROGRAM.exhaustionRecovery));
    expect(rested.exactHealth).toBe(Math.min(100, character.exactHealth + REST_PROGRAM.healthRecovery));
    expect(result.state.placements[0].weeksRemaining).toBe(3);
    expect(result.state.totalWeeksHosted).toBe(1);
  });

  it('advanceRestZoneWeek: discharges when weeksRemaining hits zero', () => {
    const state = createRestZoneState();
    const placement = { ...admitToRest(character, 1), weeksRemaining: 1 };
    state.placements = [placement];
    const result = advanceRestZoneWeek(state, [character], [], { hospitalPatientIds: [], busyCharacterIds: [] }, 2);
    expect(result.discharged).toContain('Тестовый');
    expect(result.state.placements).toHaveLength(0);
  });

  it('advanceRestZoneWeek: auto-admits exhausted when attendants posted', () => {
    const state = createRestZoneState();
    const result = advanceRestZoneWeek(state, [character], [attendant], { hospitalPatientIds: [], busyCharacterIds: [] }, 1);
    expect(result.state.placements.length).toBeGreaterThan(0);
    expect(result.logs.some(log => log.includes('ЗОНА ОТДЫХА'))).toBe(true);
  });

  it('advanceRestZoneWeek: no auto-admission without attendants', () => {
    const state = createRestZoneState();
    const result = advanceRestZoneWeek(state, [character], [], { hospitalPatientIds: [], busyCharacterIds: [] }, 1);
    expect(result.state.placements).toHaveLength(0);
  });

  it('advanceRestZoneWeek: skin improves on finishing week', () => {
    const state = createRestZoneState();
    const placement = { ...admitToRest(character, 1), weeksRemaining: 1, character: { ...character, skinCondition: 'Irritated' } as Character };
    const charWithSkin = { ...character, skinCondition: 'Irritated' } as Character;
    state.placements = [{ ...placement, characterId: 'char_1' }];
    const result = advanceRestZoneWeek(state, [charWithSkin], [], { hospitalPatientIds: [], busyCharacterIds: [] }, 1);
    const finished = result.roster[0];
    expect(finished.skinCondition).toBe('Blemished');
  });
});

describe('restZoneEngine (normalization / names)', () => {
  it('normalizeRestZone: base state for missing/raw input', () => {
    expect(normalizeRestZone(null, [])).toEqual(createRestZoneState());
    expect(normalizeRestZone(undefined, [])).toEqual(createRestZoneState());
    expect(normalizeRestZone('bad' as any, [])).toEqual(createRestZoneState());
  });

  it('normalizeRestZone: old tier converts to seats', () => {
    const state = normalizeRestZone({ level: 3 } as any, [], []);
    expect(state.seats).toBe(REST_ZONE_TIERS[2].seats);
  });

  it('normalizeRestZone: never below base seats', () => {
    const state = normalizeRestZone({ seats: 0 } as any, [], []);
    expect(state.seats).toBe(REST_ZONE_BASE_SEATS);
  });

  it('normalizeRestZone: trims placements to seats and fixes program', () => {
    const state = normalizeRestZone(
      { seats: 2, placements: [admitToRest(character, 1), admitToRest(character, 1)] },
      [character],
      []
    );
    expect(state.placements.length).toBeLessThanOrEqual(state.seats);
    expect(state.placements.every(p => p.programName === REST_PROGRAM.name)).toBe(true);
  });

  it('restZoneName: tier names up to complex, roman suffix beyond', () => {
    expect(restZoneName(3)).toBe(REST_ZONE_TIERS[0].name);
    expect(restZoneName(5)).toBe(REST_ZONE_TIERS[1].name);
    expect(restZoneName(12)).toBe(REST_ZONE_TIERS[3].name);
    expect(restZoneName(13)).toContain(REST_ZONE_TIERS[3].name);
    expect(restZoneName(13)).toContain(' I');
    expect(restZoneName(14)).toContain(' II');
  });
});
