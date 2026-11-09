import type { CampaignActCondition } from './expansionTypes';

export interface EventChoice {
  text: string;
  fundsDelta?: number;
  reputationDelta?: number;
  resultMessage: string;
  capturedSlaves?: number;
  slaveQuality?: 'low' | 'medium' | 'high';
  caravanDamage?: number;
  /**
   * Custom effect applied to the game state upon choosing this option.
   */
  effect?: (state: any) => any;
  /**
   * When true, this choice opens the slave-auction bidding flow instead of
   * resolving immediately (Idea 4: auction house). The App shows a bid modal.
   */
  startsAuction?: boolean;
  /** Weeks before this event/choice path should be repeated (engine-level anti-repeat). */
  cooldownWeeks?: number;
  /** Optional risk/consequence hint shown in UI. */
  riskHint?: string;
  /** Declarative guards used by UI/selection helpers. */
  requiresFunds?: number;
  requiresReputation?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  category: 'economy' | 'security' | 'diplomacy' | 'opportunity' | 'crisis';
  choices: EventChoice[];
  /** Condition that must be met for this event to be eligible for selection. */
  condition?: (state: any) => boolean;
  /** Structured conditions for deterministic/save-safe selection. */
  conditions?: {
    minWeek?: number;
    maxWeek?: number;
    minFunds?: number;
    maxFunds?: number;
    minReputation?: number;
    maxReputation?: number;
    acts?: CampaignActCondition[];
    buildingId?: string;
    minBuildingLevel?: number;
    employeeSpecialty?: string;
    minEmployees?: number;
  }[];
  /** Weight for selection; higher values increase the probability. */
  weight?: number;
  /** Weeks before this event may appear again after being shown. */
  cooldownWeeks?: number;
}

export interface CaravanEvent {
  id: string;
  title: string;
  description: string;
  type: 'raiders' | 'pirates' | 'bandits' | 'weather' | 'wildlife' | 'disease';
  severity: 'minor' | 'moderate' | 'severe';
  choices: CaravanEventChoice[];
}

export interface CaravanEventChoice {
  text: string;
  successChance: number;
  fundsDelta: number;
  reputationDelta: number;
  resultMessage: string;
  failureMessage: string;
  capturedSlaves?: number;
  slaveQuality?: 'low' | 'medium' | 'high';
  caravanDamage?: number;
  crewCasualties?: number;
}

export const RANDOM_EVENTS: GameEvent[] = [
  {
    id: 'event_customs_crackdown',
    title: 'Облава таможенной службы',
    description: 'Имперские таможенники в крупном региональном порту проводят проверку торговых манифестов. Они угрожают конфисковать непроверенный груз, если не будет уплачен значительный сбор или взятка.',
    category: 'security',
    weight: 5,
    choices: [
      {
        text: 'Заплатить взятку ($10,000)',
        fundsDelta: -10000,
        reputationDelta: 0,
        resultMessage: 'Взятка принята. Таможенники пропустили ваш груз без задержек.'
      },
      {
        text: 'Отказаться и апеллировать законным путём (-5 Репутации)',
        fundsDelta: 0,
        reputationDelta: -5,
        resultMessage: 'Апелляции вызвали недельные задержки в порту, нанеся ущерб вашей региональной репутации.'
      }
    ]
  },
  {
    id: 'event_market_boom',
    title: 'Внезапный товарный бум',
    description: 'Беспрецедентный рыночный спрос на предметы роскоши прорвался по всей Западной Европе и Средиземноморью. Ваша торговая сеть занимает уникальное положение для извлечения выгоды.',
    category: 'economy',
    weight: 3,
    choices: [
      {
        text: 'Масштабно инвестировать в транспорт роскоши (+$25,000)',
        fundsDelta: 25000,
        reputationDelta: 3,
        resultMessage: 'Товарный бум реализован! Ваши торговые сети принесли огромную прибыль в $25,000.'
      },
      {
        text: 'Играть безопасно и получить стандартные дивиденды (+$8,000)',
        fundsDelta: 8000,
        reputationDelta: 1,
        resultMessage: 'Получен скромный доход в $8,000 без риска.'
      }
    ]
  },
  {
    id: 'event_smuggler_offer',
    title: 'Предложение теневого контрабандиста',
    description: 'Подпольный синдикат обращается к вашим агентам с предложением использовать секретные морские маршруты, минуя все пошлины ценой потенциальной юридической ответственности.',
    category: 'opportunity',
    weight: 4,
    choices: [
      {
        text: 'Принять подпольное партнерство (+$18,000, -4 Реп)',
        fundsDelta: 18000,
        reputationDelta: -4,
        resultMessage: 'Контрабандный маршрут оказался выгодным (+$18,000), но слухи о синдикате снизили вашу репутацию (-4%).'
      },
      {
        text: 'Отказаться и сообщить о них властям (+5 Реп)',
        fundsDelta: 0,
        reputationDelta: 5,
        resultMessage: 'Предложение отклонено. Местные власти похвалили вашу законопослушную позицию (+5% Репутации).'
      }
    ]
  },
  {
    id: 'event_diplomatic_summit',
    title: 'Региональный торговый саммит',
    description: 'Вы получили приглашение на эксклюзивный торговый саммит среди мировых торговых лидеров. Ваше присутствие может закрепить долгосрочные коммерческие соглашения.',
    category: 'diplomacy',
    weight: 2,
    choices: [
      {
        text: 'Спонсировать банкет и принять делегатов (-$15,000, +8 Реп)',
        fundsDelta: -15000,
        reputationDelta: 8,
        resultMessage: 'Роскошный прием впечатлил делегатов, повысив Репутацию Синдиката на +8%!'
      },
      {
        text: 'Посетить с минимальными расходами (-$3,000, +2 Реп)',
        fundsDelta: -3000,
        reputationDelta: 2,
        resultMessage: 'Скромное участие поддерживало базовые связи.'
      }
    ]
  },
  {
    id: 'event_internal_leak',
    title: 'Внутренняя утечка данных',
    description: 'Один из ваших бухгалтеров был замечен в общении с налоговой инспекцией. Похоже, часть ваших финансовых схем стала известна властям.',
    category: 'crisis',
    weight: 3,
    condition: (state) => state.funds > 500000,
    choices: [
      {
        text: 'Заглушить скандал деньгами (-$40,000)',
        fundsDelta: -40000,
        reputationDelta: 0,
        resultMessage: 'Крупная сумма «пожертвований» заставила инспекторов закрыть глаза на несостыковки.'
      },
      {
        text: 'Попытаться скрыть следы (-10 Репутации)',
        fundsDelta: 0,
        reputationDelta: -10,
        resultMessage: 'Попытка скрыть данные провалилась, что вызвало волну подозрений в деловых кругах.'
      },
      {
        text: 'Сдать бухгалтера властям (+$5,000, -5 Реп)',
        fundsDelta: 5000,
        reputationDelta: -5,
        resultMessage: 'Вы представили бухгалтера как «одинокого предателя», получив небольшую награду, но потеряв лицо.'
      }
    ]
  },
  {
    id: 'event_rare_talent',
    title: 'Обнаружение редкого таланта',
    description: 'Ваши агенты нашли оперативника с уникальным сочетанием навыков, который ищет покровительства. Он готов присоединиться к Синдикату при условии достойной оплаты.',
    category: 'opportunity',
    weight: 2,
    choices: [
      {
        text: 'Выплатить премиальный контракт (-$20,000)',
        fundsDelta: -20000,
        reputationDelta: 2,
        resultMessage: 'Талант привлечён! В ростер добавлен высококвалифицированный оперативник.',
        effect: (state) => {
          // Logic handled in App.tsx via a signal or by adding a character here if state is passed
          return state;
        }
      },
      {
        text: 'Игнорировать предложение',
        fundsDelta: 0,
        reputationDelta: 0,
        resultMessage: 'Вы решили не рисковать бюджетом.'
      }
    ]
  },
  {
    id: 'event_police_raid',
    title: 'Полицейский рейд',
    description: 'Местные власти провели внезапную проверку одного из ваших филиалов. Они требуют «компенсацию» за нарушение санитарных норм и лицензий.',
    category: 'security',
    weight: 4,
    choices: [
      {
        text: 'Заплатить штраф ($15,000)',
        fundsDelta: -15000,
        reputationDelta: -2,
        resultMessage: 'Штраф уплачен. Полиция покидает здание, но оставила пометку о проверке.'
      },
      {
        text: 'Использовать связи в мэрии (-5 Реп)',
        fundsDelta: 0,
        reputationDelta: -5,
        resultMessage: 'Звонок влиятельному другу помог избежать штрафа, но ваша репутация среди честных бизнесменов упала.'
      }
    ]
  },
  {
    id: 'event_regional_conflict',
    title: 'Региональный конфликт',
    description: 'В одном из ваших ключевых регионов разразились беспорядки. Логистика нарушена, а риски для караванов резко возросли.',
    category: 'crisis',
    weight: 3,
    choices: [
      {
        text: 'Усилить охрану маршрутов (-$10,000)',
        fundsDelta: -10000,
        reputationDelta: 0,
        resultMessage: 'Дополнительные конвои обеспечили безопасность грузов.'
      },
      {
        text: 'Приостановить торговлю в регионе (-5,000 доход)',
        fundsDelta: -5000,
        reputationDelta: 0,
        resultMessage: 'Вы временно вывели активы из зоны конфликта, избежав потерь.'
      }
    ]
  }
];

export interface LegacyEventContext {
  week: number;
  funds: number;
  reputation: number;
  actId?: CampaignActCondition;
  employees?: { specialty?: string; status?: string }[];
  auxiliaryBuildings?: { id: string; level: number }[];
  recentEventIds?: string[];
  eventCooldowns?: Record<string, number>;
}

function legacyConditionMatches(event: GameEvent, context: LegacyEventContext): boolean {
  if (event.condition && !event.condition(context as any)) return false;
  const conditions = event.conditions;
  if (!conditions?.length) return true;
  return conditions.some(condition => {
    if (condition.minWeek !== undefined && context.week < condition.minWeek) return false;
    if (condition.maxWeek !== undefined && context.week > condition.maxWeek) return false;
    if (condition.minFunds !== undefined && context.funds < condition.minFunds) return false;
    if (condition.maxFunds !== undefined && context.funds > condition.maxFunds) return false;
    if (condition.minReputation !== undefined && context.reputation < condition.minReputation) return false;
    if (condition.maxReputation !== undefined && context.reputation > condition.maxReputation) return false;
    if (condition.acts?.length && (!context.actId || !condition.acts.includes(context.actId))) return false;
    if (condition.employeeSpecialty) {
      const employees = context.employees ?? [];
      if (!employees.some(employee => employee.specialty === condition.employeeSpecialty && (employee.status ?? 'active') === 'active')) return false;
    }
    if (condition.buildingId) {
      const building = (context.auxiliaryBuildings ?? []).find(item => item.id === condition.buildingId);
      if (!building || building.level < (condition.minBuildingLevel ?? 1)) return false;
    }
    if (condition.minEmployees !== undefined && (context.employees?.length ?? 0) < condition.minEmployees) return false;
    return true;
  });
}

function isLegacyEventOnCooldown(event: GameEvent, context: LegacyEventContext): boolean {
  const availableAt = context.eventCooldowns?.[event.id];
  if (availableAt !== undefined && availableAt > context.week) return true;
  const cooldown = event.cooldownWeeks ?? 0;
  if (cooldown <= 0 || !context.recentEventIds?.length) return false;
  const recent = context.recentEventIds.slice(-cooldown);
  return recent.includes(event.id);
}

function pickWeightedLegacyEvent(events: GameEvent[], random: () => number): GameEvent {
  const totalWeight = events.reduce((sum, event) => sum + Math.max(0, event.weight ?? 1), 0);
  if (totalWeight <= 0) return events[Math.floor(random() * events.length)] ?? events[0];
  let roll = random() * totalWeight;
  for (const event of events) {
    roll -= Math.max(0, event.weight ?? 1);
    if (roll <= 0) return event;
  }
  return events[events.length - 1] ?? events[0];
}

export function getRandomEvent(state: any, random: () => number = Math.random): GameEvent {
  const context: LegacyEventContext = {
    week: Number(state?.week) || 1,
    funds: Number(state?.funds) || 0,
    reputation: Number(state?.reputation) || 0,
    actId: state?.campaignScript?.actId,
    employees: Array.isArray(state?.employees) ? state.employees : [],
    auxiliaryBuildings: Array.isArray(state?.auxiliaryBuildings) ? state.auxiliaryBuildings : [],
    recentEventIds: Array.isArray(state?.eventHistory) ? state.eventHistory.map((entry: any) => entry?.id).filter((id: unknown): id is string => typeof id === 'string') : Array.isArray(state?.recentEventIds) ? state.recentEventIds : [],
    eventCooldowns: state?.eventCooldowns && typeof state.eventCooldowns === 'object' ? state.eventCooldowns : undefined
  };
  const eligibleEvents = RANDOM_EVENTS.filter(event => legacyConditionMatches(event, context));
  const pool = eligibleEvents.length > 0 ? eligibleEvents : RANDOM_EVENTS;
  const offCooldown = pool.filter(event => !isLegacyEventOnCooldown(event, context));
  const finalPool = offCooldown.length > 0 ? offCooldown : pool;
  return pickWeightedLegacyEvent(finalPool, random);
}

/**
 * The recurring slave-auction event (Idea 4). Its choices don't resolve directly:
 * the App intercepts them and runs a bid mini-flow against NPC buyers.
 */
export const AUCTION_EVENT: GameEvent = {
  id: 'event_slave_auction',
  title: 'Подпольный рабский аукцион',
  description: 'Теневой аукционный дом ликвидирует конфискованную партию пленников тому, кто предложит больше. Покупатели-NPC уже кружат. Вы можете войти в торги — выиграете, и элитный пленник пополнит ваш состав; проиграете, и ваше время и залог будут потрачены впустую.',
  category: 'opportunity',
  choices: [
    {
      text: 'Войти на подпольный рабский аукцион',
      fundsDelta: 0,
      reputationDelta: 0,
      resultMessage: 'Вы входите в аукционный дом и делаете ставку.',
      startsAuction: true
    },
    {
      text: 'Уйти с аукциона (-0 Репутации)',
      fundsDelta: 0,
      reputationDelta: 0,
      resultMessage: 'Вы отказываетесь делать ставку. Лот уходит другому покупателю.'
    }
  ]
};

/**
 * Returns a random event, with a recurring slave auction every four weeks.
 * Expansion event variants are selected by expansionEventsEngine.ts to keep this
 * existing legacy event API and auction handoff intact.
 */
export function getRandomEventWithAuction(
  weekOrState: number | any,
  random: () => number = Math.random
): GameEvent {
  const week = typeof weekOrState === 'number' ? weekOrState : Number(weekOrState?.week) || 1;
  if (week % 4 === 0) return AUCTION_EVENT;
  const state = typeof weekOrState === 'number' ? { week } : weekOrState;
  return getRandomEvent(state, random);
}
