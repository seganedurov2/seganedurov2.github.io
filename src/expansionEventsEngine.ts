import type { CampaignState } from './gameEngine';
import type {
  AuxiliaryBuildingState,
  DeferredExpansionEventEffect,
  Employee,
  ExpansionEvent,
  ExpansionEventChoice,
  ExpansionEventContext,
  ExpansionEventEffect
} from './expansionTypes';
import { getBuildingDefinition } from './buildingsEngine';
import { EXPANSION_EVENTS } from './content/expansionEvents';
import { t } from './i18n';

export type ExpandedEvent = ExpansionEvent;

const MAX_RECENT_EVENTS = 12;
const MAX_HISTORY = 40;
const MAX_DEFERRED_EFFECTS = 40;

function actMatches(conditionActs: ExpansionEvent['conditions'][number]['acts'], context: ExpansionEventContext): boolean {
  if (!conditionActs?.length) return true;
  if (context.actId === undefined) return false;
  const numeric = typeof context.actId === 'number'
    ? context.actId
    : ({ founding: 1, expansion: 2, syndicate: 3, reckoning: 4 } as const)[context.actId] ?? 0;
  return conditionActs.some(act => act === context.actId || act === numeric);
}

function conditionMatches(condition: ExpansionEvent['conditions'][number], context: ExpansionEventContext): boolean {
  if (condition.minWeek !== undefined && context.week < condition.minWeek) return false;
  if (condition.maxWeek !== undefined && context.week > condition.maxWeek) return false;
  if (condition.minFunds !== undefined && context.funds < condition.minFunds) return false;
  if (condition.maxFunds !== undefined && context.funds > condition.maxFunds) return false;
  if (condition.minReputation !== undefined && context.reputation < condition.minReputation) return false;
  if (condition.maxReputation !== undefined && context.reputation > condition.maxReputation) return false;
  if (!actMatches(condition.acts, context)) return false;
  if (condition.employeeSpecialty && !context.employees.some(employee => employee.specialty === condition.employeeSpecialty && employee.status === 'active')) return false;
  if (condition.minEmployees !== undefined && context.employees.length < condition.minEmployees) return false;
  if (condition.minActiveEmployees !== undefined && context.employees.filter(employee => employee.status === 'active').length < condition.minActiveEmployees) return false;
  if (condition.buildingId) {
    const building = context.auxiliaryBuildings.find(item => item.id === condition.buildingId);
    if (!building || building.level < (condition.minBuildingLevel ?? 1)) return false;
  }
  return true;
}

export function matchesExpansionEvent(
  event: ExpansionEvent,
  context: ExpansionEventContext
): boolean {
  if (!event.conditions.length) return true;
  return event.conditions.some(condition => conditionMatches(condition, context));
}

export function isEventOnCooldown(
  eventId: string,
  week: number,
  cooldowns: Record<string, number> | undefined,
  recentEventIds: string[] | undefined,
  cooldownWeeks = 0
): boolean {
  const availableAt = cooldowns?.[eventId];
  if (availableAt !== undefined && availableAt > week) return true;
  if (cooldownWeeks <= 0 || !recentEventIds?.length) return false;
  return recentEventIds.slice(-cooldownWeeks).includes(eventId);
}

function pickWeighted<T extends { weight?: number }>(events: T[], random: () => number): T | null {
  if (!events.length) return null;
  const totalWeight = events.reduce((sum, event) => sum + Math.max(0, event.weight ?? 1), 0);
  if (totalWeight <= 0) return events[Math.floor(random() * events.length)] ?? events[0] ?? null;
  let roll = random() * totalWeight;
  for (const event of events) {
    roll -= Math.max(0, event.weight ?? 1);
    if (roll <= 0) return event;
  }
  return events[events.length - 1] ?? events[0] ?? null;
}

export function getEligibleExpansionEvents(
  context: ExpansionEventContext,
  seenEventIds: string[] = [],
  events: ExpansionEvent[] = EXPANSION_EVENTS
): ExpansionEvent[] {
  void seenEventIds;
  return events.filter(event => matchesExpansionEvent(event, context));
}

export function chooseExpansionEvent(
  context: ExpansionEventContext,
  seenEventIds: string[] = [],
  random: () => number = Math.random,
  events: ExpansionEvent[] = EXPANSION_EVENTS
): ExpansionEvent | null {
  const eligible = getEligibleExpansionEvents(context, seenEventIds, events);
  if (!eligible.length) return null;
  const recent = context.recentEventIds?.length ? context.recentEventIds : seenEventIds;
  const offCooldown = eligible.filter(event => !isEventOnCooldown(event.id, context.week, context.eventCooldowns, recent, event.cooldownWeeks ?? 0));
  return pickWeighted(offCooldown.length ? offCooldown : eligible, random);
}

export function expansionEventCooldownsAfterChoice(
  current: Record<string, number> | undefined,
  event: ExpansionEvent,
  week: number
): Record<string, number> {
  const next = { ...(current ?? {}) };
  if ((event.cooldownWeeks ?? 0) > 0) next[event.id] = week + (event.cooldownWeeks ?? 0);
  return next;
}

export function expansionChoiceAvailability(choice: ExpansionEventChoice, state: { funds: number; reputation: number }): { available: boolean; reason?: string } {
  if (choice.disabledReason) return { available: false, reason: choice.disabledReason };
  const fundsCost = Math.max(0, choice.requiresFunds ?? 0, choice.effects.reduce((sum, effect) => sum + (effect.type === 'funds' ? Math.max(0, -effect.delta) : 0), 0));
  if (state.funds < fundsCost) return { available: false, reason: t('event.insufficient.funds', { amount: fundsCost.toLocaleString('ru-RU') }) };
  const reputationCost = Math.max(0, choice.requiresReputation ?? 0, choice.effects.reduce((sum, effect) => sum + (effect.type === 'reputation' ? Math.max(0, -effect.delta) : 0), 0));
  if (state.reputation < reputationCost) return { available: false, reason: t('event.insufficient.reputation', { amount: reputationCost }) };
  return { available: true };
}

export function expansionChoiceSummary(choice: ExpansionEventChoice): string[] {
  const summary: string[] = [];
  for (const effect of choice.effects) {
    if (effect.type === 'funds' && effect.delta) summary.push(`${effect.delta > 0 ? '+' : ''}${effect.delta} $`);
    if (effect.type === 'reputation' && effect.delta) summary.push(`${effect.delta > 0 ? '+' : ''}${effect.delta} реп.`);
    if (effect.type === 'employeeMorale' && effect.delta) summary.push(t('event.summary.morale', { delta: effect.delta, specialtyLabel: effect.specialty ? ` (${effect.specialty})` : '' }));
    if (effect.type === 'employeeExperience' && effect.delta) summary.push(t('event.summary.experience', { delta: effect.delta, specialtyLabel: effect.specialty ? ` (${effect.specialty})` : '' }));
    if (effect.type === 'buildingLevel' && effect.delta) summary.push(`${effect.delta > 0 ? '+' : ''}${effect.delta} ур. здания`);
  }
  if (choice.deferredEffects?.length) summary.push(t('event.summary.deferred', { count: choice.deferredEffects.length }));
  if (choice.riskHint) summary.push(t('event.summary.risk', { riskHint: choice.riskHint }));
  return summary;
}

function normalizeDeferredEffect(raw: DeferredExpansionEventEffect, week: number, sourceEventId: string, sourceChoiceId: string, index: number): DeferredExpansionEventEffect | null {
  if (!Array.isArray(raw.effects) || !raw.effects.length) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${sourceEventId}:${sourceChoiceId}:deferred:${index}`,
    sourceEventId,
    sourceChoiceId,
    triggerWeek: Math.max(week, Math.floor(Number(raw.triggerWeek) || week)),
    label: typeof raw.label === 'string' && raw.label ? raw.label : t('event.deferred.default'),
    effects: raw.effects.filter((effect): effect is ExpansionEventEffect => !!effect && typeof effect === 'object' && 'type' in effect)
  };
}

function applyExpansionEffects<T extends ExpansionEffectsState>(state: T, effects: ExpansionEventEffect[]): T {
  const fundsDelta = effects.reduce((sum, effect) => sum + (effect.type === 'funds' ? effect.delta : 0), 0);
  const reputationDelta = effects.reduce((sum, effect) => sum + (effect.type === 'reputation' ? effect.delta : 0), 0);
  const employeeMoraleEffects = effects.filter((effect): effect is Extract<ExpansionEventEffect, { type: 'employeeMorale' }> => effect.type === 'employeeMorale');
  const employeeExperienceEffects = effects.filter((effect): effect is Extract<ExpansionEventEffect, { type: 'employeeExperience' }> => effect.type === 'employeeExperience');
  const buildingEffects = effects.filter((effect): effect is Extract<ExpansionEventEffect, { type: 'buildingLevel' }> => effect.type === 'buildingLevel');

  const employees = state.employees.map(employee => {
    const moraleDelta = employeeMoraleEffects
      .filter(effect => !effect.specialty || effect.specialty === employee.specialty)
      .reduce((sum, effect) => sum + effect.delta, 0);
    const experienceDelta = employeeExperienceEffects
      .filter(effect => !effect.specialty || effect.specialty === employee.specialty)
      .reduce((sum, effect) => sum + effect.delta, 0);
    let skill = employee.skill;
    let experience = employee.experience + experienceDelta;
    while (experience >= 100 && skill < 100) {
      experience -= 100;
      skill += 1;
    }
    if (skill >= 100) experience = 0;
    return {
      ...employee,
      morale: Math.max(0, Math.min(100, employee.morale + moraleDelta)),
      skill,
      experience
    };
  });

  const auxiliaryBuildings = state.auxiliaryBuildings.map(building => {
    const delta = buildingEffects.filter(effect => effect.buildingId === building.id).reduce((sum, effect) => sum + effect.delta, 0);
    if (!delta) return building;
    const maxLevel = getBuildingDefinition(building.id).maxLevel;
    return { ...building, level: Math.max(0, Math.min(maxLevel, building.level + delta)) };
  });

  return {
    ...state,
    funds: Math.max(0, state.funds + fundsDelta),
    reputation: Math.max(0, Math.min(100, state.reputation + reputationDelta)),
    employees,
    auxiliaryBuildings
  } as T;
}

export function applyDeferredExpansionEffects<T extends ExpansionEffectsState>(state: T): T {
  const week = state.week;
  const due: DeferredExpansionEventEffect[] = [];
  const pending: DeferredExpansionEventEffect[] = [];
  for (const effect of state.deferredEventEffects ?? []) {
    if (effect.triggerWeek <= week) due.push(effect);
    else pending.push(effect);
  }
  if (!due.length) return { ...state, deferredEventEffects: pending.slice(-MAX_DEFERRED_EFFECTS) } as T;
  let next = { ...state, deferredEventEffects: pending.slice(-MAX_DEFERRED_EFFECTS) } as T;
  for (const item of due) next = applyExpansionEffects(next, item.effects);
  const log = due.map(item => t('event.log.deferred', { label: item.label })).slice(0, 3);
  return { ...next, log: [...log, ...next.log].slice(0, 50) } as T;
}

export interface ExpansionEffectsState extends CampaignState {
  employees: Employee[];
  auxiliaryBuildings: AuxiliaryBuildingState[];
  seenExpansionEventIds: string[];
  eventHistory?: import('./expansionTypes').ExpansionEventHistoryEntry[];
  eventCooldowns?: Record<string, number>;
  deferredEventEffects?: DeferredExpansionEventEffect[];
}

export function applyExpansionEventChoice<T extends ExpansionEffectsState>(
  state: T,
  event: ExpansionEvent,
  choice: ExpansionEventChoice
): T {
  let next = applyExpansionEffects(state, choice.effects);
  const deferred = (choice.deferredEffects ?? [])
    .map((effect, index) => normalizeDeferredEffect(effect, state.week, event.id, choice.id, index))
    .filter((effect): effect is DeferredExpansionEventEffect => effect !== null);
  const eventHistory = [
    ...(state.eventHistory ?? []).filter(entry => !(entry.id === event.id && entry.week === state.week && entry.choiceId === choice.id)),
    { id: event.id, week: state.week, kind: 'expansion' as const, choiceId: choice.id }
  ].slice(-MAX_HISTORY);
  return {
    ...next,
    seenExpansionEventIds: [...state.seenExpansionEventIds.filter(id => id !== event.id), event.id].slice(-MAX_RECENT_EVENTS),
    eventHistory,
    eventCooldowns: expansionEventCooldownsAfterChoice(state.eventCooldowns, event, state.week),
    deferredEventEffects: [...(state.deferredEventEffects ?? []), ...deferred].slice(-MAX_DEFERRED_EFFECTS),
    log: [`${event.title}: ${choice.resultMessage}`, ...next.log].slice(0, 50)
  } as T;
}
