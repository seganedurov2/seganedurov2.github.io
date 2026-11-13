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
  const start = snap.match(
    /@(e\d+) button "([^"]*(Продолжить|Новая|Загрузить|Начать)[^"]*)"/,
  );
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
  const badge = await page.evaluate(
    () => document.querySelector("h1")?.innerText,
  );
  return { badge };
}
