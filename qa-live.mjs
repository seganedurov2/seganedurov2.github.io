export default async function run(page, ui) {
  await page.evaluate(() => {
    localStorage.setItem(
      "emporium_auth_user",
      JSON.stringify({
        login: "qa",
        password: "qa",
        createdAt: new Date().toISOString(),
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  let snap = await ui.snapshot();
  const start = snap.match(/@(e\d+) button "([^"]*(Создать|Продолжить)[^"]*)"/);
  if (start) {
    await ui.click(start[1]);
    await page.waitForTimeout(3000);
  }
  snap = await ui.snapshot();
  const create = snap.match(/@(e\d+) button "Создать и начать игру"/);
  if (create) {
    await ui.click(create[1]);
    await page.waitForTimeout(8000);
  }
  snap = await ui.snapshot();
  const calendar = snap.match(/@(e\d+) button "НЕДЕЛЯ · ДЕНЬ[^"]*"/);
  if (calendar) {
    await ui.click(calendar[1]);
    await page.waitForTimeout(1500);
  }
  const nextDay = (await ui.snapshot()).match(
    /@(e\d+) button "Следующий день"/,
  );
  const headerBefore = await page.evaluate(
    () =>
      document.querySelector('[aria-controls="campaign-day-calendar"]')
        ?.innerText,
  );
  if (nextDay) {
    await ui.click(nextDay[1]);
    await page.waitForTimeout(1500);
  }
  const headerAfter = await page.evaluate(
    () =>
      document.querySelector('[aria-controls="campaign-day-calendar"]')
        ?.innerText,
  );
  const calendarText = await page.evaluate(() =>
    document
      .querySelector('[aria-label="Календарь кампании"]')
      ?.innerText?.slice(0, 260),
  );
  const dayPanel = await page.evaluate(() =>
    document
      .querySelector('[aria-label="День кампании"]')
      ?.innerText?.slice(0, 300),
  );
  const hasOldButton = await page.evaluate(() =>
    document.body.innerText.includes("Следующая неделя"),
  );
  return {
    headerBefore,
    headerAfter,
    hasOldButton,
    calendarText,
    dayPanel,
    nextDay: Boolean(nextDay),
  };
}
