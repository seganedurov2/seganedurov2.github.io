# Release Plan 0.6.6 — "Контракты и поставки"

## Цель
VIP/раб-контракты, репутация покупателя, риски поставок.

## Фокус
- Стабильность и обратная совместимость сохранений (`migrateCampaignState`).
- `slaveContractsEngine.ts`/`contractsEngine.ts` развивать инкрементально; React-обвязку выносить аккуратно.
- Тесты/линт/сборка должны проходить.

## Задачи
- [x] Долгосрочные контракты (база): числовые поля контрактов/прогресса защищены (`safe`/clamp в engine + нормализация), UI показывает прогресс, выплату сейчас, штраф срока и эффективный риск.
- [x] Долгосрочные контракты (KPI/бонус): поля `startWeek`/`termWeeks`/`failurePenalty`/`completionBonusReputation` опциональны, нормализуются; при успешном закрытии применяется бонус репутации (`completionBonusReputation`), срок/штраф видны в UI.
- [x] Долгосрочные контракты (расширение, save-compatible): `deadlineWeek`/`quantityOverDelivered`/KPI-бонусные поля опциональны и нормализуются; `deliverSlaves(..., { allowOverdelivery })` поддерживает KPI-перевыполнение сверх `wanted` (cap), `claimContractKpi` начисляет дедлайн/KPI-награды один раз, UI/подтверждение/журнал покрывают перевыполнение. Без изменения формата сейвов (только optional поля + дефолты).
- [x] Репутация покупателя/канала (`standing`): нормализация и clamp standing/lockout/optional `lastActiveWeek` в сейвах; влияние на риск/цены используется существующей логикой.
- [x] Репутация покупателя/канала (база, save-compatible): `applyStandingOutcome` пишет `lastActiveWeek`; добавлен `decayBuyerStandings` (мягкая деградация -1 после периода без активности, дефолт 3 нед.), weekly tick применяет decay к standings; helper `standingThresholdLabel` добавлен в engine.
- [x] Репутация покупателя/канала (ревизия, база): спавн buyer-контрактов выбирает реальный тип из `MARKET_BUYERS`/`BLACK_MARKET_BUYERS` с учётом standing/lockout/лимита; `buyerType` привязан к standing. UI отношений показывает реальные типы из standing+активных контрактов.
- [ ] Репутация покупателя/канала (расширение): явные пороги/визуализация деградации-восстановления по неделям в UI, больше разнообразия шаблонов по типу покупателя.
- [x] Риски поставки (база): явный UI-прогноз и причина риска (`contractRiskReason`: база/право/здания/рынок, удар репутации), журнал причины в логе доставки.
- [x] Риски поставки (региональные): `supplyContractRisk`/`buyFromSupplyContract` учитывают логистику/здоровье, безопасность, рынок. Источники: escort-crew (skill/loyalty) → логистика, `guardStrength`/`scandalRiskReduction`/репутация → безопасность, market effects → рынок; прогноз в `SupplyContractsPanel` и при подписи/выкупе, срыв пишет журнал и сжигает недельную партию без списания средств. `supplyRiskPercent`/`lastRiskReason` опциональны и нормализуются в сейвах.
- [x] Риски поставки (еженедельный журнал): все активные подписанные поставки получают еженедельную запись в weekly log (куплено/всего, риск/причина, отметка перед закрытием) — 1 запись/контракт/неделя, без спама на unsigned.
- [x] UI `SupplyContractsPanel`/контракты: прогресс, ожидаемый payout, риск/прогноз, длинные имена/описания с `truncate/line-clamp`.
- [x] UI: подтверждения критичных действий (`fulfillSlaveContract`, подпись/выкуп региональной поставки), журнал причин риска.
- [ ] UI: полный i18n (ru/en) для новых строк и подтверждений.
- [x] UI: подготовлен i18n-слой для ключей контрактов/поставок (`src/i18n.ts`: ru/en ключи 0.6.6). Полная замена hardcoded строк в App/панелях — в расширении (большой объём, безопасно делать точечно).
- [x] Unit-тесты: генерация контракта, eligibility/delivery, clamp риска/NaN, риск-причина, unrest edge cases.
- [x] Миграция: `slaveContracts`/`buyerStandings`/`tradeSupplyContracts` нормализуются, `legendary` поддержан, round-trip битых данных покрыт тестом.
- [x] `changelog.txt` и версия `0.6.6` в `package.json`, `package-lock.json`, Android version при релизном коммите. (Файлы обновлены; коммит делать только после изоляции unrelated dirty-файлов в рабочем дереве.)

## Критерии приёмки
- [x] `npm test` / `vitest run` — проходят затронутые engine/save/weekly-окружение кейсы (targeted suite 99 passed; slaveContracts+saveState 30 passed).
- [x] `npx tsc -b --noEmit` — успешно.
- [x] `npm run lint` — 0 ошибок (34 warning, pre-existing baseline, не из 0.6.6).
- [x] `npm run build` — успешно.
- [x] Старые/битые сохранения: контрактные поля отсутствуют/повреждены — безопасные дефолты/нормализация.

## Примечания
- Emporium-app (React/Vite/TS). Текущая ветка работы: `axiomatic-decision`.
- Не менять формат сохранений без миграции.
