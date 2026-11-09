import { describe, expect, it } from 'vitest';
import type { ExpansionEvent, ExpansionEventContext } from './expansionTypes';
import {
  applyExpansionEventChoice,
  applyDeferredExpansionEffects,
  chooseExpansionEvent,
  expansionChoiceAvailability,
  getEligibleExpansionEvents,
  matchesExpansionEvent
} from './expansionEventsEngine';

const baseContext = (overrides: Partial<ExpansionEventContext> = {}): ExpansionEventContext => ({
  week: 10,
  funds: 10000,
  reputation: 50,
  actId: 'founding',
  employees: [{ id: 'e1', name: 'T', specialty: 'teacher', gender: 'women', skill: 10, experience: 0, morale: 50, weeklyWage: 100, status: 'active', assignedBuildingId: null, hiredWeek: 1 }],
  auxiliaryBuildings: [{ id: 'school', level: 1, assignedEmployeeIds: [] }],
  recentEventIds: [],
  eventCooldowns: {},
  ...overrides
});

const event = (overrides: Partial<ExpansionEvent> = {}): ExpansionEvent => ({
  kind: 'expansion',
  id: 'evt_test',
  title: 'Test',
  description: 'd',
  category: 'education',
  conditions: [{ minWeek: 5 }],
  choices: [{ id: 'a', text: 'A', resultMessage: 'ok', effects: [{ type: 'funds', delta: 100 }] }],
  weight: 1,
  cooldownWeeks: 3,
  ...overrides
});

describe('expansionEventsEngine 0.6.8', () => {
  it('matches week/act/reputation/funds/building/personnel conditions', () => {
    expect(matchesExpansionEvent(event({ conditions: [{ minWeek: 11 }] }), baseContext())).toBe(false);
    expect(matchesExpansionEvent(event({ conditions: [{ acts: ['founding'] }] }), baseContext())).toBe(true);
    expect(matchesExpansionEvent(event({ conditions: [{ acts: [2] }] }), baseContext())).toBe(false);
    expect(matchesExpansionEvent(event({ conditions: [{ minReputation: 60 }] }), baseContext())).toBe(false);
    expect(matchesExpansionEvent(event({ conditions: [{ maxFunds: 5000 }] }), baseContext())).toBe(false);
    expect(matchesExpansionEvent(event({ conditions: [{ buildingId: 'school', minBuildingLevel: 2 }] }), baseContext())).toBe(false);
    expect(matchesExpansionEvent(event({ conditions: [{ minActiveEmployees: 2 }] }), baseContext())).toBe(false);
  });

  it('applies cooldowns and anti-repeat, then falls back safely when pool is empty', () => {
    const e1 = event({ id: 'e1', weight: 10 });
    const e2 = event({ id: 'e2', weight: 1, cooldownWeeks: 0 });
    const picked = chooseExpansionEvent(baseContext({ eventCooldowns: { e1: 99 } }), [], () => 0.99, [e1, e2]);
    expect(picked?.id).toBe('e2');
    const fallback = chooseExpansionEvent(baseContext({ eventCooldowns: { e1: 99, e2: 99 }, recentEventIds: ['e1', 'e2'] }), [], () => 0, [e1, e2]);
    expect(fallback).not.toBeNull();
  });

  it('getEligibleExpansionEvents does not mutate input and returns deterministic matches', () => {
    const ctx = baseContext();
    const before = JSON.parse(JSON.stringify(ctx));
    const list = getEligibleExpansionEvents(ctx, ['x'], [event({ id: 'a' }), event({ id: 'b', conditions: [{ minWeek: 999 }] })]);
    expect(list.map(e => e.id)).toEqual(['a']);
    expect(ctx).toEqual(before);
  });

  it('applies choice without mutating input and records cooldown/history/deferred effects', () => {
    const state = {
      week: 10, funds: 1000, reputation: 50, log: [],
      employees: baseContext().employees, auxiliaryBuildings: baseContext().auxiliaryBuildings,
      seenExpansionEventIds: [], eventHistory: [], eventCooldowns: {}, deferredEventEffects: []
    } as any;
    const before = JSON.parse(JSON.stringify(state));
    const choice = {
      id: 'a', text: 'A', resultMessage: 'ok',
      effects: [{ type: 'funds' as const, delta: -200 }, { type: 'reputation' as const, delta: 3 }],
      deferredEffects: [{ id: 'd1', sourceEventId: 'evt_test', sourceChoiceId: 'a', triggerWeek: 12, label: 'Позже', effects: [{ type: 'funds' as const, delta: 50 }] }]
    };
    const next = applyExpansionEventChoice(state, event(), choice);
    expect(state).toEqual(before);
    expect(next.funds).toBe(800);
    expect(next.reputation).toBe(53);
    expect(next.eventCooldowns.evt_test).toBe(13);
    expect(next.eventHistory.at(-1)).toMatchObject({ id: 'evt_test', week: 10, choiceId: 'a' });
    expect(next.deferredEventEffects).toHaveLength(1);
  });

  it('applies deferred effects on/after trigger week and removes them', () => {
    const state = {
      week: 12, funds: 100, reputation: 50, log: [], employees: [], auxiliaryBuildings: [], seenExpansionEventIds: [],
      deferredEventEffects: [{ id: 'd1', sourceEventId: 'e', sourceChoiceId: 'c', triggerWeek: 12, label: 'X', effects: [{ type: 'funds', delta: 25 }] }]
    } as any;
    const next = applyDeferredExpansionEffects(state);
    expect(next.funds).toBe(125);
    expect(next.deferredEventEffects).toHaveLength(0);
    expect(next.log[0]).toContain('Отложенный эффект');
  });

  it('reports unavailable choices with reasons', () => {
    expect(expansionChoiceAvailability({ id: 'a', text: 'A', resultMessage: '', effects: [{ type: 'funds', delta: -500 }] }, { funds: 100, reputation: 50 }).reason).toContain('Недостаточно средств');
  });
});
