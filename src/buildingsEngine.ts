import type { Character } from './gameEngine';
import type {
  AuxiliaryBuildingState,
  BuildingId,
  BuildingOperationalStatus,
  BuildingWeeklyEffects,
  Employee,
  EmployeeGender,
  EmployeeSpecialty
} from './expansionTypes';
import { fitsSpecialty, requiredGenderForSpecialty, specialtyDefinitionOf, specializationWeeklyEffects } from './employeesEngine';
export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  shortDescription: string;
  /** Specialties that fill a required post; the building only runs when they are all staffed. */
  compatibleSpecialties: EmployeeSpecialty[];
  /**
   * Extra posts the building accepts on top of {@link requiredEmployees}. They
   * never gate the building's operation, so a hospital keeps taking births with
   * no psychologist posted.
   */
  optionalSpecialties?: EmployeeSpecialty[];
  requiredEmployees: number;
  constructionCost: number;
  upgradeCosts: number[]; // index 0 unused; index N is the cost to upgrade level N to N+1
  /** Weeks to build from scratch; 0 (omitted in old saves) means instant. */
  constructionWeeks?: number;
  /** Weeks per upgrade level; 0 means instant. */
  upgradeWeeks?: number;
  maxLevel: number;
  effectDescriptions: string[]; // index matches building level
  weeklyEffectsByLevel: Record<number, BuildingWeeklyEffect>;
}

export interface BuildingWeeklyEffect {
  employeeTrainingBonus?: number;
  employeeMoraleBonus?: number;
  rosterHealthRecovery?: number;
  /** Escort building level: how many escorts this post contributes to caravans. */
  escortSlots?: number;
  /** Escort building level: percentage points shaved off the weekly raid roll. */
  raidRiskReduction?: number;
  /** Escort building level: percentage points added to the fight success chance. */
  raidVictoryBonus?: number;
  /** Guard building level: posts manned, each one suppressing escapes. */
  guardPosts?: number;
  /** CEO office level: weekly exhaustion relief for the protagonist. */
  leadershipRelief?: number;
  /** Legal department level: percentage points removed from contract scandal risk. */
  scandalRiskReduction?: number;
  /** Auction-house level: sale-price bonus while an auctioneer is posted. */
  auctioneerSaleBonus?: number;
  /** Hospital level: care points from the nurses posted on the ward. */
  nurseBonus?: number;
  /** Hospital level: care points from the midwives posted on the ward. */
  midwifeBonus?: number;
  /** BDSM Room level: percentage points shaved off the weekly captive-escape roll. */
  bdsmEscapeReduction?: number;
  /** BDSM Room level: submission gained per week by captives trained there. */
  bdsmTraining?: number;
  /** 0.6.7: weekly upkeep (AX) at this building level. */
  upkeep?: number;
  /** 0.6.7: additive venue revenue modifier (% points) at this level. */
  venueRevenueBonusPercent?: number;
  /** 0.6.7: additive quality/output modifier (% points). */
  qualityBonusPercent?: number;
  /** 0.6.7: additive speed modifier (% points). */
  speedBonusPercent?: number;
  /** 0.6.7: additive risk reduction (% points). */
  riskReductionBonusPercent?: number;
}

export const BUILDING_DEFINITIONS: BuildingDefinition[] = [
  {
    id: 'school',
    name: 'Школа',
    shortDescription: 'Повышает скорость профессионального обучения сотрудников.',
    compatibleSpecialties: ['teacher'],
    requiredEmployees: 1,
    constructionCost: 18000,
    upgradeCosts: [0, 12000, 22000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      '+3 опыта в неделю сотрудникам компании.',
      '+5 опыта в неделю сотрудникам компании.',
      '+7 опыта в неделю сотрудникам компании.'
    ],
    weeklyEffectsByLevel: {
      1: { employeeTrainingBonus: 3, speedBonusPercent: 5, upkeep: 100 },
      2: { employeeTrainingBonus: 5, speedBonusPercent: 10, upkeep: 200 },
      3: { employeeTrainingBonus: 7, speedBonusPercent: 15, upkeep: 300 }
    }
  },
  {
    id: 'self_development_center',
    name: 'Центр саморазвития',
    shortDescription: 'Поддерживает мораль сотрудников и их профессиональный рост.',
    compatibleSpecialties: ['coach'],
    requiredEmployees: 1,
    constructionCost: 24000,
    upgradeCosts: [0, 15000, 26000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построен.',
      '+1 к недельному изменению морали сотрудников.',
      '+2 к недельному изменению морали сотрудников.',
      '+3 к недельному изменению морали сотрудников.'
    ],
    weeklyEffectsByLevel: {
      1: { employeeMoraleBonus: 1, speedBonusPercent: 5, upkeep: 150 },
      2: { employeeMoraleBonus: 2, speedBonusPercent: 10, upkeep: 250 },
      3: { employeeMoraleBonus: 3, speedBonusPercent: 15, upkeep: 350 }
    }
  },
  {
    id: 'clinic',
    name: 'Клиника',
    shortDescription: 'Восстанавливает здоровье персонажей компании.',
    compatibleSpecialties: ['clinician'],
    requiredEmployees: 1,
    constructionCost: 28000,
    upgradeCosts: [0, 18000, 30000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      '+2 здоровья в неделю персонажам компании.',
      '+4 здоровья в неделю персонажам компании.',
      '+6 здоровья в неделю персонажам компании.'
    ],
    weeklyEffectsByLevel: {
      1: { rosterHealthRecovery: 2, qualityBonusPercent: 5, upkeep: 200 },
      2: { rosterHealthRecovery: 4, qualityBonusPercent: 10, upkeep: 300 },
      3: { rosterHealthRecovery: 6, qualityBonusPercent: 15, upkeep: 400 }
    }
  },
  {
    id: 'hospital',
    name: 'Больница',
    shortDescription: 'Медсёстры и акушерки принимают роды и лечат пациенток, психолог разбирается с персоналом.',
    compatibleSpecialties: ['nurse', 'midwife'],
    optionalSpecialties: ['psychologist'],
    requiredEmployees: 2,
    constructionCost: 45000,
    upgradeCosts: [0, 30000, 52000],
    constructionWeeks: 3,
    upgradeWeeks: 3,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      'Уход +10 очков качества, восстановление после родов 2 недели.',
      'Уход +20 очков качества, открыта операционная палата, восстановление 2–3 недели.',
      'Уход +32 очка качества, открыта реанимационная палата, восстановление 2–4 недели.'
    ],
    weeklyEffectsByLevel: {
      1: { nurseBonus: 4, midwifeBonus: 6, qualityBonusPercent: 10, upkeep: 300 },
      2: { nurseBonus: 8, midwifeBonus: 12, qualityBonusPercent: 20, upkeep: 500 },
      3: { nurseBonus: 12, midwifeBonus: 20, qualityBonusPercent: 32, upkeep: 700 }
    }
  },
  {
    id: 'caravan_depot',
    name: 'Караванная станция',
    shortDescription: 'Сопровождающие выходят на маршруты и усиливают экипаж караванов и отрядов при нападениях.',
    compatibleSpecialties: ['escort'],
    requiredEmployees: 1,
    constructionCost: 22000,
    upgradeCosts: [0, 16000, 28000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      '1 сопровождающий в экипаже каждой поездки.',
      '2 сопровождающих в экипаже каждой поездки; риск нападения −12 п.п., шанс победы в бою +6 п.п.',
      '3 сопровождающих в экипаже каждой поездки; риск нападения −25 п.п., шанс победы в бою +12 п.п.'
    ],
    weeklyEffectsByLevel: {
      1: { escortSlots: 1, riskReductionBonusPercent: 4, upkeep: 150 },
      2: { escortSlots: 2, raidRiskReduction: 12, raidVictoryBonus: 6, riskReductionBonusPercent: 8, upkeep: 250 },
      3: { escortSlots: 3, raidRiskReduction: 25, raidVictoryBonus: 12, riskReductionBonusPercent: 12, upkeep: 350 }
    }
  },
  {
    id: 'guard_post',
    name: 'Охранный пост',
    shortDescription: 'Охранники усиливают режим содержания и снижают вероятность побега пленных.',
    compatibleSpecialties: ['guard'],
    requiredEmployees: 1,
    constructionCost: 20000,
    upgradeCosts: [0, 14000, 26000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      '1 охранник на смене: шанс побега −8 п.п.',
      '2 охранника на смене: шанс побега −16 п.п.',
      '3 охранника на смене: шанс побега −24 п.п.'
    ],
    weeklyEffectsByLevel: {
      1: { guardPosts: 1, riskReductionBonusPercent: 4, upkeep: 120 },
      2: { guardPosts: 2, riskReductionBonusPercent: 8, upkeep: 240 },
      3: { guardPosts: 3, riskReductionBonusPercent: 12, upkeep: 360 }
    }
  },
  {
    id: 'bdsm_room',
    name: 'БДСМ-комната',
    shortDescription: 'Госпожа и мастер работают с рабынями дома удовольствия: воспитывают покорность и исключают побег.',
    compatibleSpecialties: ['mistress', 'master'],
    optionalSpecialties: ['janitor'],
    requiredEmployees: 2,
    constructionCost: 34000,
    upgradeCosts: [0, 20000, 36000],
    constructionWeeks: 3,
    upgradeWeeks: 3,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      'Воспитание рабынь: +2 покорности в неделю, риск побега −8 п.п.',
      'Углублённое воспитание: +4 покорности в неделю, риск побега −15 п.п.',
      'Полный режим: +6 покорности в неделю, риск побега −22 п.п.'
    ],
    weeklyEffectsByLevel: {
      1: { bdsmEscapeReduction: 8, bdsmTraining: 2, riskReductionBonusPercent: 6, upkeep: 180 },
      2: { bdsmEscapeReduction: 15, bdsmTraining: 4, riskReductionBonusPercent: 12, upkeep: 320 },
      3: { bdsmEscapeReduction: 22, bdsmTraining: 6, riskReductionBonusPercent: 18, upkeep: 460 }
    }
  },
  {
    id: 'ceo_office',
    name: 'Канцелярия CEO',
    shortDescription: 'Секретарь разгружает главного героя, отводя часть накопленного истощения.',
    compatibleSpecialties: ['secretary'],
    requiredEmployees: 1,
    constructionCost: 26000,
    upgradeCosts: [0, 17000, 30000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      'Главный герой теряет на 3 очка истощения меньше в неделю.',
      'Главный герой теряет на 6 очков истощения меньше в неделю.',
      'Главный герой теряет на 10 очков истощения меньше в неделю.'
    ],
    weeklyEffectsByLevel: {
      1: { leadershipRelief: 3, speedBonusPercent: 5, upkeep: 140 },
      2: { leadershipRelief: 6, speedBonusPercent: 10, upkeep: 260 },
      3: { leadershipRelief: 10, speedBonusPercent: 15, upkeep: 380 }
    }
  },
  {
    id: 'auction_house',
    name: 'Аукционный дом',
    shortDescription: 'Аукционист повышает выручку с продажи товаров; оценщик — дополнительный пост. Автооценка работает всегда.',
    compatibleSpecialties: ['auctioneer'],
    optionalSpecialties: ['appraiser'],
    requiredEmployees: 1,
    constructionCost: 32000,
    upgradeCosts: [0, 21000, 36000],
    constructionWeeks: 3,
    upgradeWeeks: 3,
    maxLevel: 3,
    effectDescriptions: [
      'Не построен.',
      'Аукционист: +5% к выручке от продажи товаров.',
      'Аукционист: +10% к выручке от продажи товаров.',
      'Аукционист: +15% к выручке от продажи товаров.'
    ],
    weeklyEffectsByLevel: {
      1: { auctioneerSaleBonus: 5, venueRevenueBonusPercent: 5, upkeep: 200 },
      2: { auctioneerSaleBonus: 10, venueRevenueBonusPercent: 10, upkeep: 350 },
      3: { auctioneerSaleBonus: 15, venueRevenueBonusPercent: 15, upkeep: 500 }
    }
  },
  {
    id: 'legal_dept',
    name: 'Юридический отдел',
    shortDescription: 'Юрист готовит сделки так, чтобы они реже заканчивались скандалом.',
    compatibleSpecialties: ['lawyer'],
    requiredEmployees: 1,
    constructionCost: 30000,
    upgradeCosts: [0, 19000, 34000],
    constructionWeeks: 2,
    upgradeWeeks: 2,
    maxLevel: 3,
    effectDescriptions: [
      'Не построена.',
      'Риск скандала по сделкам с пленными −5 п.п.',
      'Риск скандала по сделкам с пленными −10 п.п.',
      'Риск скандала по сделкам с пленными −18 п.п.'
    ],
    weeklyEffectsByLevel: {
      1: { scandalRiskReduction: 5, riskReductionBonusPercent: 6, upkeep: 160 },
      2: { scandalRiskReduction: 10, riskReductionBonusPercent: 12, upkeep: 280 },
      3: { scandalRiskReduction: 18, riskReductionBonusPercent: 18, upkeep: 400 }
    }
  }
];

export function createInitialBuildings(): AuxiliaryBuildingState[] {
  return BUILDING_DEFINITIONS.map(({ id }) => ({ id, level: 0, assignedEmployeeIds: [] }));
}

export function getBuildingDefinition(id: BuildingId): BuildingDefinition {
  const definition = BUILDING_DEFINITIONS.find(building => building.id === id);
  if (!definition) throw new Error(`Unknown building id: ${id}`);
  return definition;
}

/** Posts the building holds on top of the required ones. */
export function optionalPostCount(definition: BuildingDefinition): number {
  return definition.optionalSpecialties?.length ?? 0;
}

/** Every slot the building can be staffed into, required and optional. */
export function totalPostCount(definition: BuildingDefinition): number {
  return definition.requiredEmployees + optionalPostCount(definition);
}

/** Specialties a specific slot accepts; optional slots take their own role. */
export function specialtiesForSlot(definition: BuildingDefinition, slotIndex: number): EmployeeSpecialty[] {
  if (slotIndex < definition.requiredEmployees) return definition.compatibleSpecialties;
  const optional = definition.optionalSpecialties ?? [];
  return [optional[slotIndex - definition.requiredEmployees]].filter((item): item is EmployeeSpecialty => Boolean(item));
}

export function getBuildingStatus(
  building: AuxiliaryBuildingState,
  employees: Employee[]
): BuildingOperationalStatus {
  if (building.level <= 0) return 'unbuilt';
  const definition = getBuildingDefinition(building.id);
  const assigned = building.assignedEmployeeIds
    .map(id => employees.find(employee => employee.id === id))
    .filter((employee): employee is Employee => Boolean(employee && employee.status === 'active' && employee.assignedBuildingId === building.id && definition.compatibleSpecialties.includes(employee.specialty) && fitsSpecialty(employee.specialty, employee.gender)));
  return assigned.length < definition.requiredEmployees ? 'unstaffed' : 'operating';
}

/** Human-readable note for a gender-locked post, or null when it is open to anyone. */
export function genderLockNote(specialty: EmployeeSpecialty): string | null {
  const required: EmployeeGender | undefined = requiredGenderForSpecialty(specialty);
  if (!required) return null;
  return required === 'women' ? 'только женщина' : 'только мужчина';
}

/** Возможность занять конкретный пост: специальность, пол, активный статус. */
export interface PostCompatibility {
  compatible: boolean;
  reason: string | null;
}

export function checkPostCompatibility(
  employee: Employee,
  building: AuxiliaryBuildingState,
  slotIndex: number
): PostCompatibility {
  const definition = getBuildingDefinition(building.id);
  const accepted = specialtiesForSlot(definition, slotIndex);
  if (!accepted.includes(employee.specialty)) {
    return { compatible: false, reason: `Требуется специальность: ${accepted.map(specialty => specialtyDefinitionOf(specialty).label).join(' / ')}.` };
  }
  if (!fitsSpecialty(employee.specialty, employee.gender)) {
    return { compatible: false, reason: `Пост «${specialtyDefinitionOf(employee.specialty).role}» ${genderLockNote(employee.specialty)}.` };
  }
  return { compatible: true, reason: null };
}

export function getCompatibleEmployees(
  building: AuxiliaryBuildingState,
  employees: Employee[],
  slotIndex?: number
): Employee[] {
  const definition = getBuildingDefinition(building.id);
  const hasOpenSlots = building.assignedEmployeeIds.length < totalPostCount(definition);
  const accepted = slotIndex === undefined ? definition.compatibleSpecialties : specialtiesForSlot(definition, slotIndex);
  return employees.filter(employee =>
    employee.status === 'active'
    && accepted.includes(employee.specialty)
    && fitsSpecialty(employee.specialty, employee.gender)
    && (!employee.assignedBuildingId || employee.assignedBuildingId === building.id)
    && (building.assignedEmployeeIds.includes(employee.id) || hasOpenSlots)
  );
}

export function buildingActionWeeks(building: AuxiliaryBuildingState): number {
  const definition = getBuildingDefinition(building.id);
  if (building.level <= 0) return Math.max(0, Math.floor(definition.constructionWeeks ?? 0));
  if (building.level >= definition.maxLevel) return 0;
  return Math.max(0, Math.floor(definition.upgradeWeeks ?? 0));
}

export function getBuildingActionCost(building: AuxiliaryBuildingState): number | null {
  const definition = getBuildingDefinition(building.id);
  if (building.level <= 0) return definition.constructionCost;
  if (building.level >= definition.maxLevel) return null;
  return definition.upgradeCosts[building.level] ?? null;
}

export interface BuildingUpgradeStartResult {
  buildings: AuxiliaryBuildingState[];
  cost: number;
  started: boolean;
  completed: boolean;
  weeks: number;
  targetLevel: number;
}

export function startBuildingUpgrade(
  buildings: AuxiliaryBuildingState[],
  buildingId: BuildingId
): BuildingUpgradeStartResult | null {
  const building = buildings.find(item => item.id === buildingId);
  if (!building) return null;
  if ((building.upgradeWeeksRemaining ?? 0) > 0) return null;
  const cost = getBuildingActionCost(building);
  if (cost === null) return null;
  const targetLevel = building.level + 1;
  const weeks = buildingActionWeeks(building);
  if (weeks <= 0) {
    return {
      buildings: buildings.map(item => item.id === buildingId ? { ...item, level: targetLevel, upgradeWeeksRemaining: 0, upgradeTargetLevel: undefined } : item),
      cost, started: false, completed: true, weeks: 0, targetLevel
    };
  }
  return {
    buildings: buildings.map(item => item.id === buildingId ? { ...item, upgradeWeeksRemaining: weeks, upgradeTargetLevel: targetLevel } : item),
    cost, started: true, completed: false, weeks, targetLevel
  };
}

export interface BuildingUpgradeAdvanceResult {
  buildings: AuxiliaryBuildingState[];
  completedIds: BuildingId[];
}

export function advanceBuildingUpgrades(buildings: AuxiliaryBuildingState[]): BuildingUpgradeAdvanceResult {
  const completedIds: BuildingId[] = [];
  const next = buildings.map(item => {
    const remaining = Math.max(0, Math.floor(item.upgradeWeeksRemaining ?? 0));
    if (remaining <= 0) return item.upgradeWeeksRemaining ? { ...item, upgradeWeeksRemaining: 0, upgradeTargetLevel: undefined } : item;
    if (remaining <= 1) {
      const definition = getBuildingDefinition(item.id);
      const target = Math.min(definition.maxLevel, Math.max(item.level + 1, Math.floor(item.upgradeTargetLevel ?? item.level + 1)));
      completedIds.push(item.id);
      return { ...item, level: target, upgradeWeeksRemaining: 0, upgradeTargetLevel: undefined };
    }
    return { ...item, upgradeWeeksRemaining: remaining - 1 };
  });
  return { buildings: next, completedIds };
}

export function calculateBuildingWeeklyEffects(
  buildings: AuxiliaryBuildingState[],
  employees: Employee[]
): BuildingWeeklyEffects {
  const effects: BuildingWeeklyEffects = {
    employeeTrainingBonus: 0,
    employeeMoraleBonus: 0,
    rosterHealthRecovery: 0,
    guardStrength: 0,
    escortCrew: [],
    leadershipRelief: 0,
    scandalRiskReduction: 0,
    raidRiskReduction: 0,
    raidVictoryBonus: 0,
    nurseBonus: 0,
    midwifeBonus: 0,
    bdsmEscapeReduction: 0,
    bdsmTraining: 0,
    auctioneerSaleBonus: 0,
    buildingsUpkeep: 0,
    venueRevenueBonusPercent: 0,
    qualityBonusPercent: 0,
    speedBonusPercent: 0,
    riskReductionBonusPercent: 0,
    operationalBuildingIds: []
  };

  for (const building of buildings) {
    if (getBuildingStatus(building, employees) !== 'operating') continue;
    const definition = getBuildingDefinition(building.id);
    const levelEffects = definition.weeklyEffectsByLevel[building.level] ?? {};
    effects.operationalBuildingIds.push(building.id);
    effects.employeeTrainingBonus += levelEffects.employeeTrainingBonus ?? 0;
    effects.employeeMoraleBonus += levelEffects.employeeMoraleBonus ?? 0;
    effects.rosterHealthRecovery += levelEffects.rosterHealthRecovery ?? 0;
    effects.guardStrength += levelEffects.guardPosts ?? 0;
    effects.leadershipRelief += levelEffects.leadershipRelief ?? 0;
    effects.scandalRiskReduction += levelEffects.scandalRiskReduction ?? 0;
    effects.auctioneerSaleBonus += levelEffects.auctioneerSaleBonus ?? 0;
    effects.raidRiskReduction += levelEffects.raidRiskReduction ?? 0;
    effects.raidVictoryBonus += levelEffects.raidVictoryBonus ?? 0;
    effects.nurseBonus += levelEffects.nurseBonus ?? 0;
    effects.midwifeBonus += levelEffects.midwifeBonus ?? 0;
    effects.bdsmEscapeReduction += levelEffects.bdsmEscapeReduction ?? 0;
    effects.bdsmTraining += levelEffects.bdsmTraining ?? 0;
    effects.buildingsUpkeep += levelEffects.upkeep ?? 0;
    effects.venueRevenueBonusPercent += levelEffects.venueRevenueBonusPercent ?? 0;
    effects.qualityBonusPercent += levelEffects.qualityBonusPercent ?? 0;
    effects.speedBonusPercent += levelEffects.speedBonusPercent ?? 0;
    effects.riskReductionBonusPercent += levelEffects.riskReductionBonusPercent ?? 0;

    // Escort posts supply one crew member per open slot at the current level.
    const escorts = building.assignedEmployeeIds
      .map(id => employees.find(employee => employee.id === id))
      .filter((employee): employee is Employee => Boolean(employee && employee.status === 'active'));
    for (const escort of escorts) {
      for (let slot = 0; slot < (levelEffects.escortSlots ?? 0); slot++) {
        effects.escortCrew.push({ name: escort.name, skill: escort.skill, loyalty: escort.morale });
      }
    }
    // 0.6.7 specialization matrix: staffed posts contribute their role effects once per staffed post.
    for (const spec of building.assignedEmployeeIds
      .map(id => employees.find(employee => employee.id === id))
      .filter((employee): employee is Employee => Boolean(employee && employee.status === 'active'))
      .map(employee => employee.specialty)) {
      const s = specializationWeeklyEffects(spec);
      effects.venueRevenueBonusPercent += s.venueRevenueBonusPercent ?? 0;
      effects.qualityBonusPercent += s.qualityBonusPercent ?? 0;
      effects.speedBonusPercent += s.speedBonusPercent ?? 0;
      effects.riskReductionBonusPercent += s.riskReductionBonusPercent ?? 0;
    }
  }

  return effects;
}

export const healthFromExact = (health: number): Character['healthLevel'] => {
  if (health > 90) return 'Pristine';
  if (health > 75) return 'Good';
  if (health > 55) return 'Fair';
  if (health > 30) return 'Poor';
  return 'Critical';
};

export const exhaustionFromExact = (exhaustion: number): Character['exhaustionLevel'] => {
  if (exhaustion > 75) return 'Burned Out';
  if (exhaustion > 50) return 'Exhausted';
  if (exhaustion > 25) return 'Tired';
  return 'Rested';
};

export function applyClinicRecovery(roster: Character[], recovery: number): Character[] {
  if (recovery <= 0) return roster;
  return roster.map(character => {
    const exactHealth = Math.min(100, character.exactHealth + recovery);
    return {
      ...character,
      exactHealth,
      healthLevel: healthFromExact(exactHealth)
    };
  });
}
