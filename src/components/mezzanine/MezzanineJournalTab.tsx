import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { JournalEntry, JournalSectionId } from '../../content/mezzanineJournal';
import {
  getJournalSections,
  getSectionCounts,
  getTotalEntryCount,
  JOURNAL_TAB_LABEL,
  searchJournalEntries
} from '../../content/mezzanineJournal';
import { FileText } from 'lucide-react';

const SECTION_ICONS: Record<string, typeof FileText> = {
  automation_design: FileText,
  signal_processing: FileText,
  mathematical_modeling: FileText,
  information_security: FileText,
  pattern_recognition: FileText,
  systems_devices: FileText,
  parallel_computing: FileText,
  space_geo_it: FileText,
  intelligent_systems: FileText,
  applied_it: FileText,
  practical_developments: FileText,
  programs: FileText,
  announcements: FileText,
  conference_reports: FileText,
  book_reviews: FileText
};

const SECTION_COLORS: Record<string, string> = {
  automation_design: 'text-blue-400',
  signal_processing: 'text-emerald-400',
  mathematical_modeling: 'text-amber-400',
  information_security: 'text-red-400',
  pattern_recognition: 'text-purple-400',
  systems_devices: 'text-cyan-400',
  parallel_computing: 'text-indigo-400',
  space_geo_it: 'text-rose-400',
  intelligent_systems: 'text-fuchsia-400',
  applied_it: 'text-orange-400',
  practical_developments: 'text-lime-400',
  programs: 'text-violet-400',
  announcements: 'text-slate-400',
  conference_reports: 'text-stone-400',
  book_reviews: 'text-zinc-400'
};

interface MezzanineJournalTabProps {
  onOpenTab?: (tabId: string) => void;
}

function renderEntryMeta(entry: JournalEntry): React.ReactNode {
  const parts: string[] = [];
  if (entry.year) parts.push(String(entry.year));
  if (entry.issue) parts.push(entry.issue);
  if (entry.pages) parts.push(`с. ${entry.pages}`);
  switch (entry.kind) {
    case 'announcement':
      if (entry.date) parts.push(entry.date);
      if (entry.audience) parts.push(entry.audience);
      break;
    case 'program':
      if (entry.countries?.length) parts.push(entry.countries.join(', '));
      if (entry.direction) parts.push(entry.direction);
      break;
    case 'conference_report':
      if (entry.event) parts.push(entry.event);
      if (entry.location) parts.push(entry.location);
      break;
    case 'book_review':
      if (entry.bookTitle) parts.push(`«${entry.bookTitle}»`);
      if (entry.bookAuthor) parts.push(entry.bookAuthor);
      break;
    case 'practical_development':
      if (entry.application) parts.push(entry.application);
      if (entry.result) parts.push(entry.result);
      break;
  }
  if (parts.length === 0) return null;
  return <span className="text-xs text-slate-400 font-mono">{parts.join(' · ')}</span>;
}

function renderEntryBody(entry: JournalEntry): React.ReactNode {
  switch (entry.kind) {
    case 'announcement':
      return entry.audience ? <p className="text-xs text-slate-400">{entry.audience}</p> : null;
    case 'program':
      return entry.direction ? <p className="text-xs text-slate-400">{entry.direction}</p> : null;
    case 'conference_report':
      return <p className="text-xs text-slate-400">{`${entry.event ?? ''}${entry.location ? `, ${entry.location}` : ''}`.trim()}</p>;
    case 'book_review':
      return <p className="text-xs text-slate-400">{entry.bookTitle ?? ''}</p>;
    case 'practical_development':
      return entry.application ? <p className="text-xs text-slate-400">{entry.application}</p> : null;
    default:
      return null;
  }
}

export function MezzanineJournalTab({ onOpenTab: _onOpenTab }: MezzanineJournalTabProps) {
  const sections = getJournalSections();
  const sectionCounts = getSectionCounts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<JournalSectionId | 'all'>('all');
  const [activeEntry, setActiveEntry] = useState<string | null>(null);

  const visibleEntries = useMemo(() => {
    return searchJournalEntries(searchQuery).filter(
      entry => selectedSection === 'all' || entry.section === selectedSection
    );
  }, [searchQuery, selectedSection]);

  const selectedSectionMeta = sections.find(section => section.id === selectedSection);
  const isSectionEmpty = selectedSection !== 'all' && sectionCounts[selectedSection] === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" /> {JOURNAL_TAB_LABEL}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Справочник рубрикатора журнала: статьи, практические разработки,
              программы, объявления, отчёты о конференциях и рецензии. Полные тексты
              статей не распространяются в репозитории — доступ по внешним ссылкам.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{getTotalEntryCount()} записей</span>
        </div>
      </header>

      {/* Поиск и фильтры */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по журналам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value as JournalSectionId | 'all')}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          >
            <option value="all">Все разделы</option>
            {sections.map(section => (
              <option key={section.id} value={section.id}>
                {section.label} ({sectionCounts[section.id]})
              </option>
            ))}
          </select>
        </div>

        {/* Разделы журнала */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedSection('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              selectedSection === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Все разделы
          </button>
          {sections.map(section => {
            const count = sectionCounts[section.id];
            const color = SECTION_COLORS[section.id] ?? 'text-slate-400';
            return (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  selectedSection === section.id
                    ? `bg-slate-800 ${color} border border-slate-700`
                    : count === 0
                      ? 'bg-slate-800/50 text-slate-600 hover:bg-slate-700 hover:text-slate-300'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                } ${count === 0 ? 'opacity-60' : ''}`}
              >
                {section.label} ({count})
              </button>
            );
          })}
        </div>

        {isSectionEmpty && (
          <p className="text-sm text-slate-400 bg-slate-950 rounded-lg px-3 py-2 border border-slate-800">
            В разделе «{selectedSectionMeta?.label}» пока нет записей.
          </p>
        )}
      </div>

      {/* Список записей */}
      <div className="space-y-3">
        {visibleEntries.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">Записей не найдено.</p>
          </div>
        ) : (
          visibleEntries.map(entry => {
            const section = sections.find(s => s.id === entry.section);
            const color = SECTION_COLORS[entry.section] ?? 'text-slate-400';
            const Icon = SECTION_ICONS[entry.section];
            const isActive = activeEntry === entry.id;
            return (
              <article
                key={entry.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-amber-500/50 transition cursor-pointer group"
                onClick={() => setActiveEntry(isActive ? null : entry.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
                      <span className={`text-xs font-semibold ${color}`}>{section?.label}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm leading-tight group-hover:text-amber-400 transition">
                      {entry.title}
                    </h3>
                    {renderEntryMeta(entry)}
                    {entry.authors?.length && (
                      <p className="text-xs text-slate-400 mt-1">{entry.authors.join(', ')}</p>
                    )}
                    {renderEntryBody(entry) && (
                      <p className="text-xs text-slate-400 mt-1">{renderEntryBody(entry)}</p>
                    )}
                  </div>
                  {entry.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-amber-400 transition"
                      title="Открыть источник"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-label="Источник" />
                    </a>
                  )}
                </div>
                {entry.abstract && (
                  <div className="mt-3 pt-3 border-t border-slate-800 bg-slate-950/50 rounded-lg p-3">
                    <p className="text-sm text-slate-300 leading-relaxed">{entry.abstract}</p>
                    <button
                      aria-expanded={isActive}
                      onClick={(e) => { e.stopPropagation(); setActiveEntry(null); }}
                      className="mt-2 text-xs text-amber-400 underline underline-offset-4 hover:text-amber-300"
                    >
                      Свернуть
                    </button>
                  </div>
                )}
                {!entry.abstract && !isActive && (
                  <button
                    aria-expanded={false}
                    onClick={(e) => { e.stopPropagation(); setActiveEntry(entry.id); }}
                    className="mt-2 text-xs text-amber-400 underline underline-offset-4 hover:text-amber-300"
                  >
                    Подробнее
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>

      <div className="text-xs text-slate-500 text-center">
        {JOURNAL_TAB_LABEL} — справочник рубрикатора журнала: статьи, практические
        разработки, российско-белорусские и национальные программы в области
        информатики.
      </div>
    </div>
  );
}
