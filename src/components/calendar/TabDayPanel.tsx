import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  WEEKDAY_SHORT,
  buildDaySchedule,
  campaignDateForDay,
  campaignWeekForDay,
  formatCampaignDate,
  formatDayHeading,
  type DayEvent
} from '../../dayCalendar';
import type { GameTabId } from '../../dayCalendarTabs';
import type { ManagedCampaignState } from '../../saveState';

interface TabDayPanelProps {
  tab: GameTabId;
  state: ManagedCampaignState;
  /** День кампании, выбранный игроком в календаре шапки. */
  selectedDayIndex: number;
  /** Сколько недель вперёд показывать заглядывания. */
  horizonWeeks?: number;
}

const EVENT_TONES: Record<DayEvent['tone'], string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/30 bg-red-500/10 text-red-200'
};

const KIND_LABELS: Record<DayEvent['kind'], string> = {
  arrival: 'прибытие',
  departure: 'в пути',
  raid: 'риск',
  contract: 'контракт',
  supply: 'поставка',
  hospital: 'больница',
  rest: 'отдых',
  salon: 'салон',
  building: 'стройка',
  wages: 'касса',
  report: 'отчёт',
  deadline: 'срок'
};

/**
 * Дневная панель вкладки: события выбранного дня и ближайшие дни с делами
 * этой вкладки. Панель одинакова во всех разделах и читает расписание из
 * сохранения, поэтому у каждого дня есть своё содержимое на каждой вкладке.
 */
export function TabDayPanel({ tab, state, selectedDayIndex, horizonWeeks = 6 }: TabDayPanelProps) {
  const week = campaignWeekForDay(selectedDayIndex);
  const date = campaignDateForDay(selectedDayIndex);

  const rows = useMemo(() => {
    const list: { dayIndex: number; events: DayEvent[] }[] = [];
    for (let offset = 0; offset <= horizonWeeks; offset++) {
      const schedule = buildDaySchedule(state, { week: week + offset, horizonWeeks });
      schedule.days.forEach(day => {
        if (day.dayIndex < selectedDayIndex) return;
        const events = day.events.filter(event => event.tab === tab);
        if (events.length > 0) list.push({ dayIndex: day.dayIndex, events });
      });
    }
    return list.slice(0, 14);
  }, [state, tab, week, selectedDayIndex, horizonWeeks]);

  const todayEvents = rows.find(row => row.dayIndex === selectedDayIndex)?.events ?? [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2" aria-label="День кампании">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">День кампании</h3>
          <span className="font-mono text-xs font-semibold text-slate-100">
            {WEEKDAY_SHORT[date.weekday]}, {formatCampaignDate(date)}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          неделя {week} · событий сегодня: {todayEvents.length}
        </span>
      </div>

      {todayEvents.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {todayEvents.map(event => (
            <li key={event.id} className={`rounded border px-2 py-1 text-[11px] ${EVENT_TONES[event.tone]}`}>
              <span className="font-mono text-[9px] uppercase opacity-70">{KIND_LABELS[event.kind]}</span>{' '}
              <span className="font-semibold">{event.title}</span>
              {event.detail && <span className="opacity-75"> · {event.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-600">На ближайшие дни по этому разделу дел нет.</p>
      ) : (
        <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
          {rows.map(row => (
            <li key={row.dayIndex} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
              <span className="w-32 shrink-0 font-mono text-slate-500">
                {formatDayHeading(campaignDateForDay(row.dayIndex))}
              </span>
              {row.events.map(event => (
                <span
                  key={event.id}
                  title={event.detail}
                  className={`rounded border px-1.5 py-0.5 ${EVENT_TONES[event.tone]}`}
                >
                  {event.title}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
