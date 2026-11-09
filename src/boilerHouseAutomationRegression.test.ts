/**
 * Регрессия автоматики котельной: резервный котёл не гасится, пока покрытие
 * без него ниже AUTO_STOP_COVERAGE (1.6). При 0 площадок потребность — 60
 * (три служебных помещения), главный котёл даёт ровно 60 → покрытие 1.0.
 *
 * Этот сценарий раньше жил в `Emporium-app/dbg3.test.ts` как отладочный файл,
 * который намеренно бросал Error. Здесь он превращён в обычную проверку.
 */
import { describe, expect, it } from "vitest";
import {
  AUTO_STOP_COVERAGE,
  boilerHeatDemand,
  boilerHeatOutput,
  buildBoiler,
  createBoilerHouseState,
  planBoilerAutomation,
  setBoilerAutomation,
  setBoilerMode,
} from "./boilerHouseEngine";

function automated(patch: Parameters<typeof setBoilerAutomation>[1] = {}) {
  return setBoilerAutomation(createBoilerHouseState(), {
    enabled: true,
    ...patch,
  });
}

describe("boiler house automatic stop", () => {
  it("keeps the reserve boiler while coverage without it is below the stop threshold", () => {
    const built = buildBoiler(
      automated({ autoStart: true, autoStop: false }),
      "reserve",
    )!;
    const running = setBoilerMode(built, "reserve", { status: "running" });
    const state = setBoilerAutomation(running, {
      autoStop: true,
      autoStart: false,
    });
    const reserve = state.boilers.find((boiler) => boiler.id === "reserve")!;

    const heatOf = state.boilers.reduce(
      (sum, boiler) => sum + boilerHeatOutput(boiler),
      0,
    );
    const heatWithout = heatOf - boilerHeatOutput(reserve);
    const heatDemand = boilerHeatDemand(0);
    const coverageWithout = heatWithout / heatDemand;

    // Условие, на котором держится проверка: 1.0 < 1.6.
    expect(heatOf).toBe(105);
    expect(heatDemand).toBe(60);
    expect(heatWithout).toBe(60);
    expect(coverageWithout).toBeLessThan(AUTO_STOP_COVERAGE);

    const plan = planBoilerAutomation({
      state,
      week: 1,
      activeVenues: 0,
      funds: 100000,
    });
    expect(plan.stop).toEqual([]);
    expect(plan.start).toEqual([]);
    expect(plan.heatAfter).toBe(105);
    expect(reserve.status).toBe("running");
  });
});
