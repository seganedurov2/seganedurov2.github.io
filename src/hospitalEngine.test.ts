import { describe, expect, it } from 'vitest';
import {
  COMPANY_PROPERTY_AGE_DAYS,
  CRITICAL_TREATMENT_HEALTH,
  DAYS_PER_WEEK,
  GESTATION_DAYS,
  HOSPITAL_EQUIPMENT,
  HOSPITAL_WARDS,
  PREGNANCY_RISK_ADMIT,
  TREATMENT_HEALTH_THRESHOLD,
  TREATMENT_MAX_WEEKS,
  TREATMENT_TARGET_HEALTH,
  assessDelivery,
  assessObservation,
  assessPregnancyRisk,
  assessTreatment,
  bookTreatmentStay,
  complicationChance,
  consumeCareEquipment,
  consumeEquipment,
  createHospitalState,
  equipmentStock,
  needsHospitalTreatment,
  needsPregnancyObservation,
  quoteEquipment,
  quoteWards,
  recoveryWeeks,
  rollInterception,
  totalBeds,
  treatmentWeeks,
  wardCount,
  weeklyTreatmentGain,
  weeklyUpkeep
} from './hospitalEngine';
import type { Character } from './gameEngine';

const mother = {
  id: 'mother_1',
  name: 'Мать Тереза',
  gender: 'women',
  age: 28,
  exactHealth: 70,
  exactExhaustion: 40,
  loyalty: 50,
  region: 'region_1',
  assignedVenue: 'unassigned',
  pregnancy: { status: 'pregnant', daysPregnant: 100, hospitalWeeksRemaining: 0 }
};

describe('hospitalEngine (state defaults)', () => {
  it('createHospitalState: all wards and equipment start at zero', () => {
    const state = createHospitalState();
    expect(state.wardCounts).toEqual({ ward_standard: 0, ward_comfort: 0, ward_surgical: 0, ward_icu: 0 });
    expect(state.equipment).toEqual({ eq_sterile: 0, eq_analgesia: 0, eq_infant: 0, eq_emergency: 0 });
    expect(state.patients).toEqual([]);
    expect(state.ledger).toEqual([]);
  });

  it('constants: gestation, thresholds and caps', () => {
    expect(GESTATION_DAYS).toBe(140);
    expect(DAYS_PER_WEEK).toBe(7);
    expect(TREATMENT_HEALTH_THRESHOLD).toBe(40);
    expect(CRITICAL_TREATMENT_HEALTH).toBe(15);
    expect(TREATMENT_TARGET_HEALTH).toBe(85);
    expect(TREATMENT_MAX_WEEKS).toBe(4);
    expect(PREGNANCY_RISK_ADMIT).toBe(0.45);
    expect(COMPANY_PROPERTY_AGE_DAYS).toBe(16 * 365);
  });
});

describe('hospitalEngine (wards / equipment / upkeep)', () => {
  it('wardCount / equipmentStock clamp negatives and NaN to zero', () => {
    const state = createHospitalState();
    state.wardCounts.ward_standard = -5 as unknown as number;
    state.equipment.eq_sterile = NaN as unknown as number;
    expect(wardCount(state, 'ward_standard')).toBe(0);
    expect(equipmentStock(state.equipment, 'eq_sterile')).toBe(0);
  });

  it('totalBeds sums beds across owned wards', () => {
    const state = createHospitalState();
    state.wardCounts.ward_standard = 2;
    state.wardCounts.ward_icu = 1;
    expect(totalBeds(state)).toBe(2 * 2 + 1 * 1);
  });

  it('weeklyUpkeep sums per-ward upkeep', () => {
    const state = createHospitalState();
    state.wardCounts.ward_standard = 1;
    expect(weeklyUpkeep(state)).toBe(500);
  });

  it('quoteWards: affordable, locked below level, unknown ward', () => {
    const cheap = quoteWards('ward_standard', 1, 20000, 1);
    expect(cheap.affordable).toBe(true);
    expect(cheap.locked).toBe(false);
    const rich = quoteWards('ward_icu', 1, 1000000, 1);
    expect(rich.locked).toBe(true);
    expect(rich.lockReason).toContain('уровень больницы 3');
    const unknown = quoteWards('nope' as any, 1, 1000, 1);
    expect(unknown.locked).toBe(true);
    expect(unknown.affordable).toBe(false);
  });

  it('quoteEquipment: price = unit cost × quantity', () => {
    const item = HOSPITAL_EQUIPMENT.find(i => i.id === 'eq_sterile')!;
    const quote = quoteEquipment('eq_sterile', 3, 100000);
    expect(quote.unitCost).toBe(item.cost);
    expect(quote.total).toBe(item.cost * 3);
    expect(quote.affordable).toBe(true);
    const poor = quoteEquipment('eq_sterile', 3, 0);
    expect(poor.affordable).toBe(false);
  });
});

describe('hospitalEngine (interception)', () => {
  it('rollInterception: controlled random decides flag and loss fraction', () => {
    const safe = rollInterception(10000, () => 0.9);
    expect(safe.intercepted).toBe(false);
    expect(safe.loss).toBe(0);
    const hit = rollInterception(10000, () => 0.01);
    expect(hit.intercepted).toBe(true);
    expect(hit.loss).toBe(Math.round(10000 * 0.35));
  });
});

describe('hospitalEngine (treatment / wear / shortage)', () => {
  it('needsHospitalTreatment: at or below threshold, false above', () => {
    expect(needsHospitalTreatment({ exactHealth: 40 } as any)).toBe(true);
    expect(needsHospitalTreatment({ exactHealth: 41 } as any)).toBe(false);
    expect(needsHospitalTreatment({ exactHealth: 15 } as any)).toBe(true);
    expect(needsHospitalTreatment({} as any)).toBe(false);
  });

  it('weeklyTreatmentGain: ward quality and nurse bonus raise it', () => {
    const ward = HOSPITAL_WARDS.find(w => w.id === 'ward_icu')!;
    const base = weeklyTreatmentGain(ward, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 });
    const boosted = weeklyTreatmentGain(ward, { nurses: 0, midwives: 0, nurseBonus: 20, midwifeBonus: 0 });
    expect(boosted).toBeGreaterThan(base);
    expect(weeklyTreatmentGain(undefined as any, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 })).toBe(8);
  });

  it('treatmentWeeks: clamps to 1..TREATMENT_MAX_WEEKS, scales with deficiency', () => {
    expect(treatmentWeeks(84, 10)).toBe(1); // deficiency 1 -> 1 week
    expect(treatmentWeeks(50, 10)).toBe(4); // deficiency 35 -> 3.5 -> 4, capped at 4
    expect(treatmentWeeks(10, 100)).toBe(1); // huge gain -> 1 week min
    expect(treatmentWeeks(10, 1)).toBe(TREATMENT_MAX_WEEKS); // tiny gain -> max weeks
  });

  it('assessTreatment: shortage reduces weekly gain and lengthens stay', () => {
    const healthy = assessTreatment({ eq_sterile: 1, eq_analgesia: 1, eq_infant: 1 }, 'ward_standard', { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, 40, false);
    const short = assessTreatment({}, 'ward_standard', { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, 40, false);
    expect(short.missingItems.length).toBeGreaterThan(healthy.missingItems.length);
    expect(short.weeklyGain).toBeLessThan(healthy.weeklyGain);
    expect(short.weeks).toBeGreaterThanOrEqual(healthy.weeks);
  });

  it('assessTreatment: critical cases require emergency kit', () => {
    const critical = assessTreatment({}, 'ward_icu', { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, 10, true);
    expect(critical.missingItems.map(i => i.id)).toContain('eq_emergency');
  });

  it('bookTreatmentStay: returns null when no bed is free', () => {
    const state = createHospitalState(); // no wards -> no beds
    const booking = bookTreatmentStay(state, mother, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, 1);
    expect(booking).toBeNull();
  });

  it('bookTreatmentStay: books the matching ward and prices the stay', () => {
    const state = createHospitalState();
    state.wardCounts.ward_standard = 1;
    const booking = bookTreatmentStay(state, mother, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, 3);
    expect(booking).not.toBeNull();
    expect(booking!.patient.admission).toBe('treatment');
    expect(booking!.patient.weeksRemaining).toBeGreaterThan(0);
    expect(booking!.patient.weeklyGain).toBeGreaterThan(0);
  });
});

describe('hospitalEngine (delivery / observation risk)', () => {
  it('complicationChance: low health raises complication odds (controlled random)', () => {
    const healthy = { ...mother, exactHealth: 90 };
    const unhealthy = { ...mother, exactHealth: 20 };
    const roll = () => 0.3;
    const pHealthy = complicationChance(healthy as unknown as Character, true, roll);
    const pUnhealthy = complicationChance(unhealthy as unknown as Character, true, roll);
    expect(pHealthy).toBe(false);
    expect(pUnhealthy).toBe(true);
  });

  it('assessDelivery: missing always-required items apply penalty and clamp chance', () => {
    const stocked = assessDelivery({ eq_sterile: 1, eq_analgesia: 1, eq_infant: 1 }, 'ward_standard', false, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 });
    const bare = assessDelivery({}, 'ward_standard', false, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 });
    expect(bare.missingItems.length).toBeGreaterThan(stocked.missingItems.length);
    expect(bare.equipmentPenalty).toBeGreaterThanOrEqual(stocked.equipmentPenalty);
    expect(bare.successChance).toBeLessThanOrEqual(stocked.successChance);
  });

  it('consumeEquipment / consumeCareEquipment burn per-delivery items, never below zero', () => {
    const stock = { eq_sterile: 1, eq_analgesia: 1, eq_infant: 1, eq_emergency: 0 };
    const assessment = assessDelivery(stock, 'ward_standard', false, { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 });
    const after = consumeEquipment(stock, assessment);
    expect(after.eq_sterile).toBe(0);
    expect(after.eq_emergency).toBe(0); // never below zero
    const afterC = consumeCareEquipment(stock, true);
    expect(afterC.eq_emergency).toBe(0);
  });

  it('assessPregnancyRisk: clamps to 0..1, lists reasons', () => {
    const risky = assessPregnancyRisk({ exactHealth: 10, exactExhaustion: 90, age: 40, pregnancy: mother.pregnancy } as any, {});
    expect(risky.score).toBeGreaterThan(0);
    expect(risky.score).toBeLessThanOrEqual(1);
    expect(risky.reasons.length).toBeGreaterThan(0);
    const safe = assessPregnancyRisk({ exactHealth: 90, exactExhaustion: 10, age: 20, pregnancy: { ...mother.pregnancy, daysPregnant: 10 } } as any, { eq_analgesia: 1, eq_infant: 1 });
    expect(safe.score).toBeLessThan(risky.score);
  });

  it('needsPregnancyObservation: false when not pregnant or at term', () => {
    expect(needsPregnancyObservation({ pregnancy: { status: 'not_pregnant' as any } } as any, {})).toBe(false);
    expect(needsPregnancyObservation({ pregnancy: { status: 'pregnant', daysPregnant: GESTATION_DAYS, hospitalWeeksRemaining: 0 } } as any, {})).toBe(false);
  });

  it('assessObservation: survival clamps 15..95, weeks 1..OBSERVATION_MAX_WEEKS', () => {
    const highRisk = assessObservation({}, 'ward_standard', { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, { score: 1, reasons: [] });
    const lowRisk = assessObservation({ eq_analgesia: 1, eq_infant: 1 }, 'ward_icu', { nurses: 5, midwives: 5, nurseBonus: 50, midwifeBonus: 50 }, { score: 0, reasons: [] });
    expect(highRisk.survivalChance).toBeGreaterThanOrEqual(15);
    expect(lowRisk.survivalChance).toBeLessThanOrEqual(95);
    expect(highRisk.weeks).toBeGreaterThanOrEqual(1);
    expect(lowRisk.weeks).toBeLessThanOrEqual(3);
  });
});

describe('hospitalEngine (recovery / escort)', () => {
  it('recoveryWeeks: clamps to 1..4; ICU with bonus hits the cap', () => {
    const base = recoveryWeeks({ nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 }, HOSPITAL_WARDS[0]);
    const boosted = recoveryWeeks({ nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 50 }, HOSPITAL_WARDS[3]);
    expect(base).toBe(1);
    expect(boosted).toBe(4);
  });
});
