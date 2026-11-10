/**
 * Minimal i18n for Emporium (Telegram Mini App).
 *
 * Default language: Russian. English translations provided for the
 * settings/modals/skeletons surfaces that were added in this sprint.
 * Full app translation is out of scope — the game UI remains Russian.
 */

export type Lang = 'ru' | 'en';

const DICTIONARIES: Record<Lang, Record<string, string>> = {
  ru: {
    // Theme
    'theme.light': 'Светлая тема',
    'theme.dark': 'Тёмная тема',

    // Backup
    'backup.title': 'Резервное копирование',
    'backup.hint': 'Экспорт всех сохранений, настроек и журнала аудита в файл. Импорт восстанавливает их из файла.',
    'backup.password.label': 'Пароль шифрования (опционально)',
    'backup.password.placeholder': 'Пароль для зашифрованного бэкапа',
    'backup.import.password.label': 'Пароль импорта (если зашифрован)',
    'backup.import.password.placeholder': 'Пароль для расшифровки',
    'backup.import.file.label': 'Файл бэкапа для импорта',
    'backup.export': 'Экспорт бэкапа',
    'backup.exporting': 'Экспорт…',
    'backup.import': 'Импорт бэкапа',
    'backup.importing': 'Импорт…',
    'backup.done': 'Готово',
    'backup.done.export': 'Сохранено как файл',
    'backup.done.import': 'Восстановлено из файла',
    'backup.error': 'Ошибка',

    // Contracts / supplies (0.6.6)
    'contract.confirm.deliver': 'Подтвердить поставку',
    'contract.deliver.confirm': 'Доставить {qty} пленник(ов) по контракту «{title}»?\nРиск скандала: {risk}\nШтраф за срыв срока: {penalty}',
    'contract.deliver.confirm.noPenalty': 'Доставить {qty} пленник(ов) по контракту «{title}»?\nРиск скандала: {risk}',
    'contract.deliver.risk': 'Риск скандала',
    'contract.deliver.penalty': 'Штраф за срыв срока',
    'contract.supply.sign.title': 'Подписать контракт поставки',
    'contract.supply.sign.confirm': 'Подписать контракт поставки с {region}?\nДо {qty} чел./нед., {price}/гол., {weeks} нед.\nПрогноз риска срыва: {risk}',
    'contract.supply.buy.title': 'Выкупить партию',
    'contract.supply.buy.confirm': 'Выкупить до {qty} чел. у {region} за {cost}?\n{risk}\nПри срыве поставки партия этой недели не будет отгружена.',
    'contract.supply.signed': 'Контракт с регионом {region} подписан.',
    'contract.supply.bought': 'Куплено {qty} пленник(ов) у {region} за {cost}.',
    'contract.supply.disrupted': 'Срыв поставки',
    'contract.supply.disrupted.msg': 'Срыв поставки ({region}): {risk}. Партия недели не отгружена.',
    'contract.supply.forecast': 'Прогноз риска',
    'contract.supply.needSign': 'Сначала подпишите контракт.',
    'contract.supply.noFunds': 'Недостаточно средств: одна голова стоит {price}.',
    'contract.supply.lotBought': 'Недельная партия уже выкуплена.',
    'contract.supply.filter.all': 'Все контракты',
    'contract.supply.filter.unsigned': 'Не подписаны',
    'contract.supply.filter.signed': 'Подписаны',
    'contract.supply.filter.available': 'Есть партия',
    'contract.supply.filter.soldOut': 'Квота выкуплена',
    'contract.supply.search': 'Поиск по названию, покупателю, региону или описанию…',
    'contract.supply.searchLabel': 'Поиск по контрактам поставок',
    'contract.supply.filterLabel': 'Фильтр контрактов поставок',
    'contract.supply.empty': 'Нет открытых поставок от регионов. Отправьте 5–15 торговых караванов в один регион и доведите их до прибытия — регион откроет поставку по партнёрской цене.',
    'contract.supply.none': 'Нет контрактов по текущим условиям поиска. Измените фильтры или сбросьте их.',
    'contract.supply.summary': 'Контрактов {shown}/{total} · подписано {signed}',
    'contract.supply.signedState': 'Подписан · выкуп открыт',
    'contract.supply.unsignedState': 'Не подписан · подпишите для выкупа',
    'contract.supply.signAction': 'Подписать контракт',
    'contract.supply.buyAction': 'Купить {qty} {word}',
    'contract.supply.lotSold': 'Партия выкуплена',
    'contract.supply.noMoneyShort': 'Недостаточно средств',
    'contract.supply.progress': 'Прогресс поставки: {title}',
    'contract.supply.lotLine': 'Партия {cost} · {left} доступно',
    'contract.supply.quotaReset': 'Квота выкуплена до следующей недели',
    'contract.supply.caravans': '{n} доставленных караванов',

    // Error boundary
    'error.title': 'Ошибка в компоненте',
    'error.retry': 'Попробовать снова',
    'error.unknown': 'Неизвестная ошибка',

    // Events (0.6.8)
    'event.type.update': 'Обновление',
    'event.type.dilemma': 'Дилемма',
    'event.choice.unavailable': 'Выбор недоступен.',
    'event.log.result': 'Результат события: {msg}',
    'event.log.deferred': 'Отложенный эффект: {label}',
    'event.deferred.default': 'Отложенный эффект',
    'event.summary.morale': '{delta} мораль{specialtyLabel}',
    'event.summary.experience': '+{delta} опыт{specialtyLabel}',
    'event.summary.building': '{delta} ур. здания',
    'event.summary.deferred': 'отложено: {count}',
    'event.summary.risk': '{riskHint}',
    'event.insufficient.funds': 'Недостаточно средств: нужно {amount} $.',
    'event.insufficient.reputation': 'Недостаточно репутации: нужно {amount}.',
    'event.weekly.notification': 'Наступила неделя {week}. Чистый доход: {income}{loan}.',
    'event.weekly.loan': ' — Кредит: -{amount} $.',

    // Mezzanine report
    'report.title': 'Технический отчёт по мезонину',
    'report.object': 'Объект',
    'report.region': 'Регион',
    'report.city': 'Город',
    'report.params': 'Параметры расчёта',
    'report.load': 'Несущая способность пола',
    'report.fire': 'Огнестойкость конструкций',
    'report.height': 'Высота потолка',
    'report.tiers': 'Количество ярусов',
    'report.aup': 'АУП каждого яруса',
    'report.materials': 'Негорючие материалы',
    'report.result': 'Итог',
    'report.compliant': 'Соответствует нормативам',
    'report.noncompliant': 'Обнаружены нарушения',
    'report.issues': 'Нарушения',
    'report.recommendations': 'Рекомендации',
    'report.stu': 'Требуется СТУ (123-ФЗ ст. 78)',
    'report.footer': 'Сгенерировано в приложении Эмпориум. Отчёт носит информационный характер.'
  },
  en: {
    'theme.light': 'Light theme',
    'theme.dark': 'Dark theme',

    'backup.title': 'Backup',
    'backup.hint': 'Export all saves, settings and audit trail to a file. Import restores them from a file.',
    'backup.password.label': 'Encryption password (optional)',
    'backup.password.placeholder': 'Password for encrypted backup',
    'backup.import.password.label': 'Import password (if encrypted)',
    'backup.import.password.placeholder': 'Password to decrypt',
    'backup.import.file.label': 'Backup file to import',
    'backup.export': 'Export backup',
    'backup.exporting': 'Exporting…',
    'backup.import': 'Import backup',
    'backup.importing': 'Importing…',
    'backup.done': 'Done',
    'backup.done.export': 'Saved to file',
    'backup.done.import': 'Restored from file',
    'backup.error': 'Error',

    'contract.confirm.deliver': 'Confirm delivery',
    'contract.deliver.confirm': 'Deliver {qty} captive(s) for contract "{title}"?\nScandal risk: {risk}\nTerm penalty: {penalty}',
    'contract.deliver.confirm.noPenalty': 'Deliver {qty} captive(s) for contract "{title}"?\nScandal risk: {risk}',
    'contract.deliver.risk': 'Scandal risk',
    'contract.deliver.penalty': 'Term penalty',
    'contract.supply.sign.title': 'Sign supply contract',
    'contract.supply.sign.confirm': 'Sign supply contract with {region}?\nUp to {qty}/week, {price}/head, {weeks} weeks.\nRisk forecast: {risk}',
    'contract.supply.buy.title': 'Buy shipment',
    'contract.supply.buy.confirm': 'Buy up to {qty} from {region} for {cost}?\n{risk}\nIf disrupted, this week’s shipment is not delivered.',
    'contract.supply.signed': 'Contract with {region} signed.',
    'contract.supply.bought': 'Bought {qty} captives from {region} for {cost}.',
    'contract.supply.disrupted': 'Supply disrupted',
    'contract.supply.disrupted.msg': 'Supply disrupted ({region}): {risk}. This week’s shipment not delivered.',
    'contract.supply.forecast': 'Risk forecast',
    'contract.supply.needSign': 'Sign the contract first.',
    'contract.supply.noFunds': 'Not enough funds: one captive costs {price}.',
    'contract.supply.lotBought': 'This week’s lot already bought.',
    'contract.supply.filter.all': 'All contracts',
    'contract.supply.filter.unsigned': 'Unsigned',
    'contract.supply.filter.signed': 'Signed',
    'contract.supply.filter.available': 'Available lot',
    'contract.supply.filter.soldOut': 'Quota bought',
    'contract.supply.search': 'Search by title, buyer, region, or description…',
    'contract.supply.searchLabel': 'Search supply contracts',
    'contract.supply.filterLabel': 'Filter supply contracts',
    'contract.supply.empty': 'No open regional supplies. Send 5–15 trade caravans to one region and deliver them — the region will open a partner supply.',
    'contract.supply.none': 'No contracts match the current filters.',
    'contract.supply.summary': 'Contracts {shown}/{total} · signed {signed}',
    'contract.supply.signedState': 'Signed · purchases open',
    'contract.supply.unsignedState': 'Unsigned · sign to buy',
    'contract.supply.signAction': 'Sign contract',
    'contract.supply.buyAction': 'Buy {qty} {word}',
    'contract.supply.lotSold': 'Lot bought',
    'contract.supply.noMoneyShort': 'Not enough funds',
    'contract.supply.progress': 'Supply progress: {title}',
    'contract.supply.lotLine': 'Lot {cost} · {left} available',
    'contract.supply.quotaReset': 'Quota bought until next week',
    'contract.supply.caravans': '{n} delivered caravans',

    'error.title': 'Component error',
    'error.retry': 'Try again',
    'error.unknown': 'Unknown error',

    'report.title': 'Mezzanine technical report',
    'report.object': 'Object',
    'report.region': 'Region',
    'report.city': 'City',
    'report.params': 'Calculation parameters',
    'report.load': 'Floor load capacity',
    'report.fire': 'Fire resistance',
    'report.height': 'Ceiling height',
    'report.tiers': 'Number of tiers',
    'report.aup': 'AUP per tier',
    'report.materials': 'Non-combustible materials',
    'report.result': 'Result',
    'report.compliant': 'Compliant with regulations',
    'report.noncompliant': 'Violations detected',
    'report.issues': 'Violations',
    'report.recommendations': 'Recommendations',
    'report.stu': 'STU required (123-FZ art. 78)',
    'report.footer': 'Generated in the Emporium app. Report is for information only.',

    // Events (0.6.8)
    'event.type.update': 'Update',
    'event.type.dilemma': 'Dilemma',
    'event.choice.unavailable': 'Choice unavailable.',
    'event.log.result': 'Event result: {msg}',
    'event.log.deferred': 'Deferred effect: {label}',
    'event.deferred.default': 'Deferred effect',
    'event.summary.morale': '{delta} morale{specialtyLabel}',
    'event.summary.experience': '+{delta} experience{specialtyLabel}',
    'event.summary.building': '{delta} building level',
    'event.summary.deferred': 'deferred: {count}',
    'event.summary.risk': '{riskHint}',
    'event.insufficient.funds': 'Not enough funds: need {amount} $.',
    'event.insufficient.reputation': 'Not enough reputation: need {amount}.',
    'event.weekly.notification': 'Week {week} begins. Net income: {income}{loan}.',
    'event.weekly.loan': ' — Credit: -{amount} $.',
  }
};

let currentLang: Lang = 'ru';

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: string, varsOrLang?: Record<string, string | number> | Lang, lang?: Lang): string {
  const vars = typeof varsOrLang === 'object' && varsOrLang !== null ? varsOrLang : undefined;
  const l = (typeof varsOrLang === 'string' ? varsOrLang : lang) ?? currentLang;
  let out = DICTIONARIES[l][key] ?? DICTIONARIES['ru'][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
