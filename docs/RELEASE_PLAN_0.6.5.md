# Release Plan 0.6.5 — "Рынок и спрос"

## Цель
Динамика цен/спроса, арбитраж, UI индикаторы.

## Фокус
- Стабильность и обратная совместимость сохранений (`migrateCampaignState`).
- Модули `*Engine.ts` не переписывать радикально; React-обвязку выносить аккуратно.
- Тесты/линт/сборка должны проходить.

## Задачи
- [x] Реализовать/уточнить механики релиза: `marketEconomyEngine.ts` —
      `safeNumber`/`safeAmount`/`computeWeeklyTotals`, зажим спроса и влияния,
      `updateRegionalMarketAfterPurchase`, `decayMarketDynamics`,
      `calculateArbitrage`/`findBestArbitrage`, начальные словари регионов.
- [x] Обновить UI/тексты: карточка сделки в `GlobalMarketTab` показывает тир
      спроса, множитель, влияние со скидкой и маржу арбитража.
- [x] Добавить/обновить unit-тесты: `marketEconomyEngine.test.ts` (25 кейсов) +
      кейс миграции в `saveState.test.ts`.
- [x] Обновить `changelog.txt` и версию: 0.6.5 в `package.json`,
      `package-lock.json`, `android/app/build.gradle` (versionCode 8).

## Критерии приёмки
- [x] `npm run lint` — без ошибок (34 прежних предупреждения, baseline).
- [x] `npm test` / `vitest run` — проходят (256 тестов, 28 файлов).
- [x] `npm run build` — успешен.
- [x] `npx tsc -b --noEmit` — успешен.
- [x] Старые сохранения загружаются: поля `marketDemand`/`regionalStanding`
      нормализуются, отсутствие полей даёт пустые словари.

## Примечания
- Emporium-app (React/Vite/TS). Текущая ветка работы: `axiomatic-decision`.
- Не менять формат сохранений без миграции.
