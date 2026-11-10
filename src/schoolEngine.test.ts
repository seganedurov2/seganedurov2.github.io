import { describe, expect, it } from 'vitest';
import type { Character } from './gameEngine';
import {
  SCHOOL_COURSES,
  SCHOOL_COURSE_BY_ID,
  TEACHING_QUALITY_WEIGHTS,
  STUDENT_SKILL_CAP_RATIO,
  teachingQuality,
  studentSkillCap,
  canTeachCourse,
  teachingStatOf,
  charismaStatOf,
  intelligenceStatOf,
  tickSchool,
  enrollStudent,
  cancelEnrolment,
  type SchoolEnrolment,
  type TeacherProfile
} from './schoolEngine';

const baseTeacher: TeacherProfile = {
  name: 'Наставник',
  skill: 70,
  teachingSkill: 70,
  charisma: 60,
  intelligence: 50
};

const baseStudent = (overrides: Partial<Character> = {}): Character => ({
  id: 's1',
  name: 'Ученик',
  gender: 'women',
  age: 22,
  exactHealth: 80,
  wounds: [],
  skill: 50,
  submission: 50,
  loyalty: 50,
  region: 'region_1',
  regionName: 'Регион 1',
  ...overrides
} as Character);

describe('schoolEngine (progress / levels / formulas)', () => {
  it('teachingQuality: weighted blend 50/25/25, clamped 0-100', () => {
    expect(teachingQuality(baseTeacher)).toBe(
      Math.round(70 * 0.5 + 60 * 0.25 + 50 * 0.25)
    );
    // defaults fill missing stats neutrally
    expect(teachingQuality({ name: 't', skill: 100 })).toBe(
      Math.round(100 * 0.6 * 0.5 + 50 * 0.25 + 50 * 0.25)
    );
    expect(teachingQuality({ name: 't', skill: 0, teachingSkill: 0, charisma: 0, intelligence: 0 })).toBe(0);
  });

  it('teachingStatOf / charismaStatOf / intelligenceStatOf defaults', () => {
    expect(teachingStatOf({ skill: 100 } as TeacherProfile)).toBe(60);
    expect(charismaStatOf({} as TeacherProfile)).toBe(50);
    expect(intelligenceStatOf({} as TeacherProfile)).toBe(50);
    expect(teachingStatOf({ skill: 40, teachingSkill: 90 } as TeacherProfile)).toBe(90);
  });

  it('studentSkillCap: 90% of teacher skill, never below 1', () => {
    expect(studentSkillCap({ skill: 100 })).toBe(90);
    expect(studentSkillCap({ skill: 70 })).toBe(63);
    expect(studentSkillCap({ skill: 1 })).toBe(1);
    expect(studentSkillCap({ skill: 0 })).toBe(1);
  });

  it('STUDENT_SKILL_CAP_RATIO is 0.9', () => {
    expect(STUDENT_SKILL_CAP_RATIO).toBe(0.9);
  });

  it('canTeachCourse: teaching stat vs minTeacherLevel', () => {
    const weak = { ...baseTeacher, teachingSkill: 10 };
    const strong = { ...baseTeacher, teachingSkill: 90 };
    expect(canTeachCourse(weak, SCHOOL_COURSE_BY_ID.basic)).toBe(false); // basic needs 20
    expect(canTeachCourse(strong, SCHOOL_COURSE_BY_ID.vocational)).toBe(true); // vocational needs 40
  });

  it('TEACHING_QUALITY_WEIGHTS sum to 1', () => {
    const sum = TEACHING_QUALITY_WEIGHTS.teaching + TEACHING_QUALITY_WEIGHTS.charisma + TEACHING_QUALITY_WEIGHTS.intelligence;
    expect(sum).toBe(1);
  });

  it('SCHOOL_COURSES: four tracks, each with duration/fee/rewards', () => {
    expect(SCHOOL_COURSES).toHaveLength(4);
    for (const course of SCHOOL_COURSES) {
      expect(typeof course.durationWeeks).toBe('number');
      expect(course.durationWeeks).toBeGreaterThan(0);
      expect(typeof course.weeklyFee).toBe('number');
      expect(typeof course.skillReward).toBe('number');
      expect(typeof course.submissionReward).toBe('number');
      expect(typeof course.weeklyIncome).toBe('number');
      expect(typeof course.minTeacherLevel).toBe('number');
      expect(course.minTeacherLevel).toBeGreaterThan(0);
    }
    const byId = SCHOOL_COURSE_BY_ID;
    expect(byId.basic.durationWeeks).toBe(4);
    expect(byId.vocational.durationWeeks).toBe(6);
    expect(byId.dispositional.durationWeeks).toBe(3);
    expect(byId.commercial.durationWeeks).toBe(4);
    // Commercial is the only paid (income) track
    expect(byId.commercial.weeklyIncome).toBeGreaterThan(0);
    expect(SCHOOL_COURSES.filter(c => c.weeklyIncome > 0)).toHaveLength(1);
  });

  it('SCHOOL_COURSE_BY_ID covers all course ids', () => {
    const ids = new Set(SCHOOL_COURSES.map(c => c.id));
    expect(Object.keys(SCHOOL_COURSE_BY_ID).sort()).toEqual([...ids].sort());
  });
});

describe('schoolEngine (tick / progress / risk mitigation)', () => {
  const week = 5;
  const teacher = baseTeacher;

  it('tickSchool: enrolment advances one week per tick, not yet graduate', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'basic', weeksAttended: 0, startedWeek: 1 }];
    const roster = [baseStudent()];
    const result = tickSchool({ roster, enrolments, teacher, week });
    expect(result.graduates).toHaveLength(0);
    expect(result.enrolments).toHaveLength(1);
    expect(result.enrolments[0].weeksAttended).toBe(1);
    expect(result.feesCollected).toBe(SCHOOL_COURSE_BY_ID.basic.weeklyFee);
  });

  it('tickSchool: student graduates at durationWeeks and gains skill/submission', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'basic', weeksAttended: 3, startedWeek: 1 }];
    const roster = [baseStudent()];
    const result = tickSchool({ roster, enrolments, teacher, week });
    expect(result.graduates).toHaveLength(1);
    const student = result.roster[0];
    expect(student.trainedAtEmporium).toBe(true);
    expect(student.skill).toBeGreaterThanOrEqual(50);
    expect(result.log.some(line => line.includes('завершил'))).toBe(true);
  });

  it('tickSchool: skill capped at studentSkillCap of teacher', () => {
    const weakTeacher: TeacherProfile = { name: 'Weak', skill: 20, teachingSkill: 20, charisma: 20, intelligence: 20 };
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'basic', weeksAttended: 3, startedWeek: 1 }];
    const student = baseStudent({ skill: 10 }); // below the 18 cap
    const result = tickSchool({ roster: [student], enrolments, teacher: weakTeacher, week });
    expect(result.roster[0].skill).toBeLessThanOrEqual(studentSkillCap(weakTeacher));
  });

  it('tickSchool: incapacitated student (wounds or low health) does not advance', () => {
    const wounded = baseStudent({ id: 'w1', wounds: [{ id: 'w1', type: 'bruise', severity: 1 }] as any });
    const sick = baseStudent({ id: 'w2', exactHealth: 20 });
    const enrolments: SchoolEnrolment[] = [
      { characterId: 'w1', courseId: 'basic', weeksAttended: 0, startedWeek: 1 },
      { characterId: 'w2', courseId: 'basic', weeksAttended: 0, startedWeek: 1 }
    ];
    const result = tickSchool({ roster: [wounded, sick], enrolments, teacher, week });
    expect(result.graduates).toHaveLength(0);
    expect(result.enrolments).toHaveLength(2);
    expect(result.enrolments.every(e => e.weeksAttended === 0)).toBe(true);
    expect(result.feesCollected).toBe(0);
  });

  it('tickSchool: dispositional course raises submission/loyalty, not skill', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'dispositional', weeksAttended: 2, startedWeek: 1 }];
    const student = baseStudent({ skill: 50, submission: 40, loyalty: 40 });
    const result = tickSchool({ roster: [student], enrolments, teacher, week });
    expect(result.roster[0].skill).toBe(50);
    expect(result.roster[0].submission).toBeGreaterThan(40);
    expect(result.roster[0].loyalty).toBeGreaterThan(40);
    expect(result.roster[0].trainedAtEmporium).toBeUndefined();
  });

  it('tickSchool: commercial course grants income, no fee', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'commercial', weeksAttended: 3, startedWeek: 1 }];
    const result = tickSchool({ roster: [baseStudent()], enrolments, teacher, week });
    expect(result.feesCollected).toBe(0);
    expect(result.commercialIncome).toBe(SCHOOL_COURSE_BY_ID.commercial.weeklyIncome);
  });

  it('tickSchool: no teacher uses default quality 40 and cap 60', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'basic', weeksAttended: 3, startedWeek: 1 }];
    const student = baseStudent({ skill: 10 }); // well below 60 cap
    const result = tickSchool({ roster: [student], enrolments, teacher: null, week });
    expect(result.graduates).toHaveLength(1);
    expect(result.roster[0].skill).toBeGreaterThan(10);
  });

  it('tickSchool: enrolments for characters not on roster are dropped', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 'ghost', courseId: 'basic', weeksAttended: 0, startedWeek: 1 }];
    const result = tickSchool({ roster: [baseStudent()], enrolments, teacher, week });
    expect(result.enrolments).toHaveLength(0);
    expect(result.feesCollected).toBe(0);
  });
});

describe('schoolEngine (enrolment lifecycle)', () => {
  const week = 3;

  it('enrollStudent: replaces earlier enrolment for same character', () => {
    const enrolments: SchoolEnrolment[] = [
      { characterId: 's1', courseId: 'basic', weeksAttended: 2, startedWeek: 1 }
    ];
    const next = enrollStudent(enrolments, 's1', 'vocational', week);
    expect(next).toHaveLength(1);
    expect(next[0].courseId).toBe('vocational');
    expect(next[0].weeksAttended).toBe(0);
    expect(next[0].startedWeek).toBe(week);
  });

  it('enrollStudent: keeps other characters enrolments', () => {
    const enrolments: SchoolEnrolment[] = [
      { characterId: 's1', courseId: 'basic', weeksAttended: 1, startedWeek: 1 },
      { characterId: 's2', courseId: 'dispositional', weeksAttended: 0, startedWeek: 2 }
    ];
    const next = enrollStudent(enrolments, 's1', 'commercial', week);
    expect(next).toHaveLength(2);
    expect(next.find(e => e.characterId === 's2')?.courseId).toBe('dispositional');
  });

  it('cancelEnrolment: removes the character', () => {
    const enrolments: SchoolEnrolment[] = [
      { characterId: 's1', courseId: 'basic', weeksAttended: 1, startedWeek: 1 },
      { characterId: 's2', courseId: 'dispositional', weeksAttended: 0, startedWeek: 2 }
    ];
    const next = cancelEnrolment(enrolments, 's1');
    expect(next).toHaveLength(1);
    expect(next[0].characterId).toBe('s2');
    expect(cancelEnrolment([], 's1')).toEqual([]);
  });

  it('cancelEnrolment: unknown character is a no-op', () => {
    const enrolments: SchoolEnrolment[] = [{ characterId: 's1', courseId: 'basic', weeksAttended: 1, startedWeek: 1 }];
    expect(cancelEnrolment(enrolments, 'nope')).toEqual(enrolments);
  });
});
