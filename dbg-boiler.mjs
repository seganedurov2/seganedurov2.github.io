import {
  createBoilerHouseState,
  setBoilerAutomation,
  buildBoiler,
  setBoilerMode,
  boilerHeatOutput,
  boilerHeatDemand,
  planBoilerAutomation,
  BOILER_FUEL_BY_ID,
} from "./src/boilerHouseEngine.ts";

const automated = (patch = {}) =>
  setBoilerAutomation(createBoilerHouseState(), { enabled: true, ...patch });
const built = buildBoiler(
  automated({ autoStart: true, autoStop: false }),
  "reserve",
);
const running = setBoilerMode(built, "reserve", { status: "running" });
const state = setBoilerAutomation(running, {
  autoStop: true,
  autoStart: false,
});
console.log(
  "fuel",
  BOILER_FUEL_BY_ID[state.boilers[0].fuel],
  state.boilers[0].fuel,
);
state.boilers.forEach((b) =>
  console.log(
    b.id,
    b.status,
    b.hoursPerWeek,
    b.wear,
    "heat",
    boilerHeatOutput(b),
  ),
);
console.log(
  "demand",
  boilerHeatDemand(0),
  "stops",
  JSON.stringify(state.automation),
);
const plan = planBoilerAutomation({
  state,
  week: 1,
  activeVenues: 0,
  funds: 100000,
});
console.log(JSON.stringify(plan));
console.log('src', planBoilerAutomation.toString().slice(planBoilerAutomation.toString().indexOf('// 3'), planBoilerAutomation.toString().indexOf('// 3') + 900));
