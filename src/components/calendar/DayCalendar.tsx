import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CALENDAR_START_YEAR,
  DAYS_PER_WEEK,
  WEEKDAY_SHORT,
  buildDaySchedule,
  campaignDateForDay,
  campaignWeekForDay,
  firstDayIndexOfWeek,
  formatCampaignDate,
  formatDayHeading,
  formatMonthHeading,
  monthGrid,
  type CampaignDate,
  type DayEvent
} from '../../dayCalendar';
import type { ManagedCampaignState } from '../../saveState';

interface DayCalendarProps {
  state: ManagedCampaignState;
  /** День, выбранный в календаре (по умолчанию — первый день текущей недели). */
  selectedDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  /** Перейти на неделю: сдвиг в неделях относительно недели сохранения. */
  onSelectWeek?: (week: number) => void;
}

const EVENT_TONES: Record<DayEvent['tone'], string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/30 bg-red-500/10 text-red-200'
};

/**
 * Календарь кампании: сетка месяца начиная с января 1845 года, лента дней
 * текущей недели и список событий выбранного дня.
 */
export function DayCalendar({ state, selectedDayIndex, onSelectDay, onSelectWeek }: DayCalendarProps) {
  const selected = campaignDateForDay(selectedDayIndex);
  const [monthCursor, setMonthCursor] = useState(() => ({ year: selected.year, month: selected.month }));

  const schedule = useMemo(
    () => buildDaySchedule(state, { week: campaignWeekForDay(selectedDayIndex) }),
    [state, selectedDayIndex]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, DayEvent[]>();
    schedule.days.forEach(day => map.set(day.dayIndex, day.events));
    return map;
  }, [schedule]);

  const cells = useMemo(() => monthGrid(monthCursor.year, monthCursor.month), [monthCursor]);
  const todayWeek = Math.max(1, Math.floor(state.week));
  const selectedWeek = campaignWeekForDay(selectedDayIndex);
  const canGoBefore = monthCursor.year > CALENDAR_START_YEAR || monthCursor.month > 0;

  const shiftMonth = (delta: number) => {
    setMonthCursor(previous => {
      const date = new Date(Date.UTC(previous.year, previous.month + delta, 1));
      const year = Math.max(CALENDAR_START_YEAR, date.getUTCFullYear());
      const month = date.getUTCFullYear() < CALENDAR_START_YEAR ? 0 : date.getUTCMonth();
      return { year, month };
    });
  };

  const selectDate = (date: CampaignDate) => {
    onSelectDay(date.dayIndex);
    const week = campaignWeekForDay(date.dayIndex);
    onSelectWeek?.(week);
  };

  const jumpToWeek = (week: number) => {
    const target = Math.max(1, week);
    const dayIndex = firstDayIndexOfWeek(target);
    onSelectDay(dayIndex);
    onSelectWeek?.(target);
    const date = campaignDateForDay(dayIndex);
    setMonthCursor({ year: date.year, month: date.month });
  };

  const renderCell = (date: CampaignDate | null, index: number) => {
    if (!date) return <div key={`empty-${index}`} className="min-h-11" aria-hidden="true" />;
    const isSelected = date.dayIndex === selectedDayIndex;
    const isCurrentWeek = campaignWeekForDay(date.dayIndex) === todayWeek;
    const events = eventsByDay.get(date.dayIndex) ?? [];
    const label = String(date.day);
    return (
      <button
        key={date.dayIndex}
        type="button"
        onClick={() => selectDate(date)}
        aria-pressed={isSelected}
        title={formatCampaignDate(date)}
        className={`relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${isSelected
            ? 'border-amber-400 bg-amber-400/20 font-bold text-amber-100'
            : isCurrentWeek
              ? 'border-slate-600 bg-slate-800/80 text-slate-100 hover:border-amber-400/50'
              : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
      >
        <span className="font-mono">{label}</span>
        {events.length > 0 && (
          <span className="mt-0.5 flex items-center gap-0.5" aria-label={`событий: ${events.length}`}>
            {events.slice(0, 3).map(event => (
              <span
                key={event.id}
                className={`h-1 w-1 rounded-full ${event.tone === 'danger' ? 'bg-red-400'
                    : event.tone === 'warning' ? 'bg-amber-400'
                      : event.tone === 'success' ? 'bg-emerald-400'
                        : 'bg-sky-400'
                  }`}
              />
            ))}
          </span>
        )}
      </button>
    );
  };

  const selectedEvents = eventsByDay.get(selectedDayIndex) ?? [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80" aria-label="Календарь кампании">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Календарь</h3>
          <span className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            с {CALENDAR_START_YEAR}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => jumpToWeek(todayWeek)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Неделя {todayWeek}
          </button>
          <button
            type="button"
            onClick={() => jumpToWeek(selectedWeek - 1)}
            disabled={selectedWeek <= 1}
            aria-label="Предыдущая неделя календаря"
            className="rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => jumpToWeek(selectedWeek + 1)}
            aria-label="Следующая неделя календаря"
            className="rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-300 transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Сетка месяца */}
        <div className="w-full max-w-md">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canGoBefore}
              aria-label="Предыдущий месяц"
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs font-semibold text-slate-200">
              {formatMonthHeading(monthCursor.year, monthCursor.month)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Следующий месяц"
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-500">
            {WEEKDAY_SHORT.map(label => <span key={label}>{label}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map(renderCell)}
          </div>
        </div>

        {/* Дни недели */}
        <div className="flex min-w-0 flex-col">
          <div className="grid grid-cols-7 gap-1">
            {schedule.days.map(day => {
              const isSelected = day.dayIndex === selectedDayIndex;
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  onClick={() => onSelectDay(day.dayIndex)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border px-1.5 py-1 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${isSelected
                      ? 'border-amber-400/70 bg-amber-400/10'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                >
                  <span className="block text-[10px] font-bold uppercase text-slate-500">{WEEKDAY_SHORT[day.date.weekday]}</span>
                  <span className="block font-mono text-xs font-semibold text-slate-100">{day.date.day}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {day.events.length > 0 ? `${day.events.length} соб.` : 'пусто'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-white">{formatDayHeading(selected)}</h4>
              <span className="font-mono text-[10px] text-slate-500">
                неделя {selectedWeek} · {formatCampaignDate(selected)}
              </span>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-600">На этот день ничего не запланировано.</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {selectedEvents.map(event => (
                  <li key={event.id} className={`rounded border px-2 py-1 ${EVENT_TONES[event.tone]}`}>
                    <span className="block text-[11px] font-semibold">{event.title}</span>
                    {event.detail && <span className="block text-[10px] opacity-80">{event.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800 px-3 py-1.5 font-mono text-[10px] text-slate-600">
        Неделя {selectedWeek} · {DAYS_PER_WEEK} дней · {formatCampaignDate(selected)}
      </footer>
    </section>
  );
}
