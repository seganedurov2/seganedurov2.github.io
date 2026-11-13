import { describe, expect, it } from "vitest";
import {
  CALENDAR_START_YEAR,
  DAYS_PER_WEEK,
  buildDaySchedule,
  campaignDateForDay,
  campaignWeekForDate,
  campaignWeekForDay,
  dayIndexForDate,
  firstDayIndexOfWeek,
  formatCampaignDate,
  monthGrid,
} from "./dayCalendar";
import { createInitialCampaign } from "./saveState";

describe("dayCalendar dates", () => {
  it("starts the campaign on 1 January 1845", () => {
    const first = campaignDateForDay(0);
    expect(CALENDAR_START_YEAR).toBe(1845);
    // 1 января 1845 — среда (2 при счёте с понедельника).
    expect(first).toMatchObject({ year: 1845, month: 0, day: 1, weekday: 2 });
    expect(formatCampaignDate(first)).toBe("1 января 1845");
  });

  it("maps weeks to seven-day blocks from week 1", () => {
    expect(campaignWeekForDay(0)).toBe(1);
    expect(campaignWeekForDay(6)).toBe(1);
    expect(campaignWeekForDay(7)).toBe(2);
    expect(firstDayIndexOfWeek(12)).toBe(11 * DAYS_PER_WEEK);
    expect(campaignWeekForDay(firstDayIndexOfWeek(12))).toBe(12);
  });

  it("round-trips dates and week numbers", () => {
    const dayIndex = dayIndexForDate(1845, 0, 1);
    expect(dayIndex).toBe(0);
    expect(dayIndexForDate(1846, 0, 1)).toBe(365);
    expect(campaignWeekForDate(1845, 0, 1)).toBe(1);
    expect(campaignDateForDay(365)).toMatchObject({
      year: 1846,
      month: 0,
      day: 1,
    });
  });

  it("lays out months with Monday as the first column", () => {
    const cells = monthGrid(1845, 0);
    expect(cells.length % DAYS_PER_WEEK).toBe(0);
    expect(cells[0]).toBeNull(); // 1 января 1845 — среда
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});

describe("buildDaySchedule", () => {
  it("places a caravan arrival on the last day of its due week", () => {
    const campaign = createInitialCampaign({ fresh: false, week: 12 });
    const schedule = buildDaySchedule(campaign, { week: 12 });
    expect(schedule.days).toHaveLength(DAYS_PER_WEEK);
    const withCaravan = schedule.days
      .flatMap((day) => day.events)
      .find((event) => event.id.startsWith("caravan:"));
    expect(withCaravan).toBeDefined();
    expect(withCaravan!.tab).toBe("caravans");
  });

  it("gives every day of the week a date inside that week", () => {
    const campaign = createInitialCampaign({ fresh: true, week: 20 });
    const schedule = buildDaySchedule(campaign, { week: 20 });
    schedule.days.forEach((day) => {
      expect(campaignWeekForDay(day.dayIndex)).toBe(20);
      expect(day.date.dayIndex).toBe(day.dayIndex);
    });
  });
});
