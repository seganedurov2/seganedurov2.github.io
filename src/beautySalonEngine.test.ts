import { describe, expect, it } from 'vitest';
import {
  TREATMENTS,
  MANAGER_TRAITS,
  SALON_LEVELS
} from './beautySalonEngine';

describe('beautySalonEngine (treatments)', () => {
  it('TREATS: every treatment has id, category, cost, time, supplies, description', () => {
    for (const t of TREATMENTS) {
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(['hair_color', 'hair_length', 'hairstyle', 'facial_hair', 'body_hair', 'tanning', 'skin'].includes(t.category)).toBe(true);
      expect(typeof t.baseCost).toBe('number');
      expect(t.baseCost).toBeGreaterThan(0);
      expect(typeof t.timeHours).toBe('number');
      expect(t.timeHours).toBeGreaterThan(0);
      expect(typeof t.suppliesConsumed).toBe('number');
      expect(t.suppliesConsumed).toBeGreaterThan(0);
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('TREATS: known ids and categories', () => {
    const byId = Object.fromEntries(TREATMENTS.map(t => [t.id, t]));
    expect(byId['t_hairstyle']?.category).toBe('hairstyle');
    expect(byId['t_skin_condition']?.category).toBe('skin');
    expect(byId['t_tanning']?.category).toBe('tanning');
    expect(byId['t_hair_color']?.baseCost).toBe(150);
    expect(byId['t_hair_length']?.timeHours).toBe(3);
    expect(byId['t_body_hair']?.suppliesConsumed).toBe(4);
  });

  it('TREATS: no duplicate ids', () => {
    const ids = TREATMENTS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('beautySalonEngine (manager traits)', () => {
  it('MANAGER_TRAITS: every trait has id, name, bonuses, modifier', () => {
    for (const m of MANAGER_TRAITS) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe('string');
      expect(typeof m.capacityBonus).toBe('number');
      expect(typeof m.clientBonus).toBe('number');
      expect(typeof m.tipBonus).toBe('number');
      expect(typeof m.costModifier).toBe('number');
      expect(m.costModifier).toBeGreaterThan(0);
    }
  });

  it('MANAGER_TRAITS: known values', () => {
    const byId = Object.fromEntries(MANAGER_TRAITS.map(m => [m.id, m]));
    expect(byId['mt_master_stylist']?.tipBonus).toBe(0.25);
    expect(byId['mt_efficient_supply']?.costModifier).toBe(0.8);
    expect(byId['mt_high_capacity']?.capacityBonus).toBe(2);
    expect(byId['mt_charisma']?.clientBonus).toBe(0.3);
  });

  it('MANAGER_TRAITS: no duplicate ids', () => {
    const ids = MANAGER_TRAITS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('beautySalonEngine (salon levels)', () => {
  it('SALON_LEVELS: 4 levels ascending, workstations and costs grow', () => {
    expect(SALON_LEVELS).toHaveLength(4);
    for (let i = 1; i < SALON_LEVELS.length; i++) {
      expect(SALON_LEVELS[i].level).toBe(SALON_LEVELS[i - 1].level + 1);
      expect(SALON_LEVELS[i].workstations).toBeGreaterThan(SALON_LEVELS[i - 1].workstations);
      expect(SALON_LEVELS[i].upgradeCost).toBeGreaterThan(SALON_LEVELS[i - 1].upgradeCost);
      expect(SALON_LEVELS[i].supplyCapacity).toBeGreaterThan(SALON_LEVELS[i - 1].supplyCapacity);
    }
  });

  it('SALON_LEVELS: level 1 is free starter', () => {
    const l1 = SALON_LEVELS[0];
    expect(l1.level).toBe(1);
    expect(l1.upgradeCost).toBe(0);
    expect(l1.workstations).toBe(2);
    expect(l1.name).toContain('Бутик');
  });

  it('SALON_LEVELS: level 4 is imperial', () => {
    const l4 = SALON_LEVELS[3];
    expect(l4.level).toBe(4);
    expect(l4.workstations).toBe(15);
    expect(l4.upgradeCost).toBe(200000);
    expect(l4.name).toContain('Имперский');
  });
});
