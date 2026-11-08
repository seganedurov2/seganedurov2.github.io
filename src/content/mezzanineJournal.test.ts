import { describe, expect, it } from 'vitest';
import {
  JOURNAL_ENTRIES,
  JOURNAL_SECTION_IDS,
  JOURNAL_SECTIONS,
  JOURNAL_TAB_LABEL,
  getEntriesBySection,
  getEntryById,
  getJournalSections,
  getSectionCounts,
  getTotalEntryCount,
  searchJournalEntries
} from './mezzanineJournal';

describe('journal tab label', () => {
  it('is a non-empty Russian label', () => {
    expect(typeof JOURNAL_TAB_LABEL).toBe('string');
    expect(JOURNAL_TAB_LABEL.length).toBeGreaterThan(0);
  });
});

describe('sections', () => {
  it('declares exactly 15 rubric ids', () => {
    expect(JOURNAL_SECTION_IDS).toHaveLength(15);
  });

  it('has unique section ids', () => {
    const ids = JOURNAL_SECTION_IDS as string[];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes a label for every section id', () => {
    const byId = new Map(JOURNAL_SECTIONS.map(s => [s.id, s]));
    for (const id of JOURNAL_SECTION_IDS) {
      const section = byId.get(id);
      expect(section).toBeDefined();
      expect(section!.label.length).toBeGreaterThan(0);
    }
    expect(getJournalSections()).toHaveLength(JOURNAL_SECTION_IDS.length);
  });
});

describe('entries', () => {
  it('have unique ids', () => {
    const ids = JOURNAL_ENTRIES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('have required fields and valid section/kind', () => {
    const kinds = new Set(['article', 'announcement', 'program', 'conference_report', 'book_review', 'practical_development']);
    for (const entry of JOURNAL_ENTRIES) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.title).toBe('string');
      expect(entry.title.length).toBeGreaterThan(0);
      expect(JOURNAL_SECTION_IDS).toContain(entry.section);
      expect(kinds.has(entry.kind as never)).toBe(true);
    }
  });

  it('covers all 15 rubrics', () => {
    const covered = new Set(JOURNAL_ENTRIES.map(e => e.section));
    expect(covered.size).toBe(JOURNAL_SECTION_IDS.length);
    for (const id of JOURNAL_SECTION_IDS) expect(covered.has(id)).toBe(true);
  });
});

describe('selectors', () => {
  it('getSectionCounts sums to total and matches per-section filters', () => {
    const counts = getSectionCounts();
    expect(getTotalEntryCount()).toBe(JOURNAL_ENTRIES.length);
    let sum = 0;
    for (const id of JOURNAL_SECTION_IDS) {
      expect(typeof counts[id]).toBe('number');
      expect(counts[id]).toBe(getEntriesBySection(id).length);
      sum += counts[id];
    }
    expect(sum).toBe(getTotalEntryCount());
  });

  it('getEntriesBySection returns only entries of that section', () => {
    for (const id of JOURNAL_SECTION_IDS) {
      const entries = getEntriesBySection(id);
      for (const entry of entries) expect(entry.section).toBe(id);
    }
  });

  it('getEntryById finds existing and misses unknown', () => {
    const first = JOURNAL_ENTRIES[0]!;
    expect(getEntryById(first.id)?.id).toBe(first.id);
    expect(getEntryById('no_such_id')).toBeUndefined();
  });

  it('search returns all entries for empty query', () => {
    expect(searchJournalEntries('')).toHaveLength(JOURNAL_ENTRIES.length);
    expect(searchJournalEntries('   ')).toHaveLength(JOURNAL_ENTRIES.length);
  });

  it('search matches title, authors and tags case-insensitively', () => {
    const byTitle = searchJournalEntries('мезонин');
    expect(byTitle.length).toBeGreaterThan(0);
    expect(byTitle.every(e => e.title.toLowerCase().includes('мезонин') || (e.abstract ?? '').toLowerCase().includes('мезонин'))).toBe(true);

    const byAuthor = searchJournalEntries('Сидорова');
    expect(byAuthor.some(e => (e.authors ?? []).some(a => a.toLowerCase().includes('сидорова')))).toBe(true);

    const byTag = searchJournalEntries('ГИС');
    expect(byTag.length).toBeGreaterThan(0);

    const none = searchJournalEntries('zzz_nonexistent_query');
    expect(none).toHaveLength(0);
  });
});
