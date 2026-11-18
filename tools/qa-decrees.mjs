/**
 * Проверка вкладки «Указы и приказы»: подпись ЭП в реальном браузере.
 * Запуск: node tools/cdp-smoke.mjs http://localhost:4178/ --script tools/qa-decrees.mjs
 * (или через skills/browser-automation/browser.mjs).
 */
export default async function run(page, ui) {
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await page.waitForTimeout(1500);

  // Входим в игру: в свежем профиле — регистрация.
  const register = page.getByRole('button', { name: 'Зарегистрироваться' });
  if (await register.count()) {
    await register.click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Придумайте логин').fill('qa-decrees');
    await page.getByPlaceholder('Придумайте пароль').fill('qa-pass-123');
    await page.getByPlaceholder('Подтвердите пароль').fill('qa-pass-123');
    await register.click();
    await page.waitForTimeout(1500);
  }

  // Входим в игру, если показано главное меню.
  const menu = await ui.snapshot();
  const enter = menu.match(
    /@(e\d+) (?:button|link) "[^"]*(?:Играть|Продолжить|Начать|Войти)/,
  );
  if (enter) {
    await ui.click(enter[1]);
    await page.waitForTimeout(1200);
  }

  // Экран создания кампании: оставляем значения по умолчанию и стартуем.
  const create = page.getByRole('button', { name: 'Создать и начать игру' });
  if (await create.count()) {
    await create.click();
    await page.waitForTimeout(2500);
  }

  // Открываем вкладку через кнопку навигации.
  const nav = await ui.snapshot();
  const tabMatch = nav.match(/@(e\d+) (?:button|link) "Указы и приказы"/);
  if (!tabMatch) return { error: "tab not found", nav: nav.slice(0, 3000) };
  await ui.click(tabMatch[1]);
  await page.waitForTimeout(800);

  const snapshot = await page.evaluate(() => document.body.innerText);
  const hasForm =
    snapshot.includes("Указы и приказы") && snapshot.includes("Ключ подписи");

  // Заполняем документ.
  const labels = await ui.snapshot();
  const input = (placeholder) =>
    labels.match(new RegExp(`@(e\\d+) [^\\n]*${placeholder}`))?.[1];
  const addressee = input("директору по логистике");
  const title = input("О порядке отгрузки");
  const passphrase = input("восемь слов");

  const fillByLabel = async (label, value) => {
    const locator = page.getByLabel(label);
    if (await locator.count()) {
      await locator.first().fill(value);
      return true;
    }
    return false;
  };

  await fillByLabel("Адресат", "Директору по логистике Д. Новаку");
  await fillByLabel("Заголовок", "О порядке отгрузки партии");
  await fillByLabel(
    "Текст",
    "Партии с мезонина отгружать только при двух подписях. Срок — пятница.",
  );
  await fillByLabel(
    "Пара слов",
    "артель калиновка полночь реестр подпись сургуч конвой касса",
  );
  await page.waitForTimeout(200);

  const afterFill = await ui.snapshot();
  const keyButton = afterFill.match(/@(e\d+) button "Загрузить ключ"/);
  if (keyButton) {
    await ui.click(keyButton[1]);
    await page.waitForFunction(
      () => document.body.innerText.includes("ключ в памяти"),
      null,
      { timeout: 20000 },
    );
  }

  const beforeSign = await ui.snapshot();
  const signButton = beforeSign.match(/@(e\d+) button "Подписать ЭП"/);
  if (!signButton)
    return {
      error: "sign button not found",
      inputs: { addressee, title, passphrase },
      snapshot: beforeSign.slice(0, 3000),
    };
  await ui.click(signButton[1]);

  await page.waitForFunction(
    () =>
      document.body.innerText.includes("подпись действительна") ||
      document.body.innerText.includes("недействительна"),
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    const save = localStorage.getItem("emporium_save_slot_1") || "";
    return {
      valid: text.includes("подпись действительна"),
      invalid: text.includes("подпись недействительна"),
      registered: /Указ № 1\/\d+/.test(text),
      savedInCampaign: save.includes("Ed25519"),
      fingerprintShown: /Отпечаток: [0-9A-F]{4}/.test(text),
    };
  });

  await page.screenshot({ path: "tools/qa-decrees.png", fullPage: false });
  return { hasForm, ...result };
}
