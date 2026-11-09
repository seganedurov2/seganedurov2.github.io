import { describe, expect, it } from 'vitest';
import { getRandomEvent, getRandomEventWithAuction } from './eventsEngine';

describe('eventsEngine 0.6.8', () => {
  it('uses deterministic random and respects cooldown/history fallback safely', () => {
    const state = { week: 5, funds: 1000, reputation: 50, eventCooldowns: {}, eventHistory: [] };
    const a = getRandomEvent(state, () => 0);
    const b = getRandomEvent(state, () => 0);
    expect(a.id).toBe(b.id);
  });

  it('keeps every-4-weeks auction hook', () => {
    expect(getRandomEventWithAuction(4).id).toBe('event_slave_auction');
    expect(getRandomEventWithAuction({ week: 8 }).id).toBe('event_slave_auction');
  });

  it('falls back when all eligible events are cooling down', () => {
    const state = {
      week: 5, funds: 1000, reputation: 50,
      eventCooldowns: Object.fromEntries([
        'event_customs_crackdown','event_market_boom','event_smuggler_offer','event_diplomatic_summit',
        'event_internal_leak','event_rare_talent','event_police_raid','event_regional_conflict'
      ].map(id => [id, 99])),
      eventHistory: []
    };
    expect(getRandomEvent(state, () => 0)?.id).toBeTruthy();
  });
});
