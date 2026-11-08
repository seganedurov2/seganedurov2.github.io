/**
 * Журнал «Информатика» — справочник контента рубрикатора.
 *
 * save-format neutral: статические справочные метаданные, без привязки к
 * кампании и без полей в saveState / миграциях. Полные тексты статей не
 * распространяются внутри репозитория (ограничение авторского права): в
 * репозитории только метаданные (заголовок, авторы, выпуск, страницы,
 * аннотация, теги) и внешние ссылки/идентификаторы; в UI показывается
 * сводка и предлагается переход по ссылке.
 *
 * Источник контента: проверенный в репозиторий справочник, составленный по
 * рубрикатору журнала «Информатика»; это проверенная в репозиторий точка
 * правды для контента вкладки (для данного релиза).
 */

export type JournalSectionId =
  | 'automation_design'
  | 'signal_processing'
  | 'mathematical_modeling'
  | 'information_security'
  | 'pattern_recognition'
  | 'systems_devices'
  | 'parallel_computing'
  | 'space_geo_it'
  | 'intelligent_systems'
  | 'applied_it'
  | 'practical_developments'
  | 'programs'
  | 'announcements'
  | 'conference_reports'
  | 'book_reviews';

export const JOURNAL_SECTION_IDS: readonly JournalSectionId[] = [
  'automation_design',
  'signal_processing',
  'mathematical_modeling',
  'information_security',
  'pattern_recognition',
  'systems_devices',
  'parallel_computing',
  'space_geo_it',
  'intelligent_systems',
  'applied_it',
  'practical_developments',
  'programs',
  'announcements',
  'conference_reports',
  'book_reviews'
] as const;

export const JOURNAL_TAB_LABEL = 'Журнал «Информатика»';

export interface JournalSectionMeta {
  id: JournalSectionId;
  label: string;
}

export const JOURNAL_SECTIONS: readonly JournalSectionMeta[] = [
  { id: 'automation_design', label: 'Автоматизация проектирования' },
  { id: 'signal_processing', label: 'Обработка сигналов, изображений и речи' },
  { id: 'mathematical_modeling', label: 'Математическое моделирование' },
  { id: 'information_security', label: 'Информационная безопасность' },
  { id: 'pattern_recognition', label: 'Распознавание образов' },
  { id: 'systems_devices', label: 'Системы, приборы и устройства' },
  { id: 'parallel_computing', label: 'Параллельные вычисления' },
  { id: 'space_geo_it', label: 'Космические ИТ и геоинформатика' },
  { id: 'intelligent_systems', label: 'Интеллектуальные системы' },
  { id: 'applied_it', label: 'Прикладные информационные технологии' },
  { id: 'practical_developments', label: 'Практические разработки' },
  { id: 'programs', label: 'Российско-белорусские и национальные программы' },
  { id: 'announcements', label: 'Объявления' },
  { id: 'conference_reports', label: 'Отчеты о конференциях' },
  { id: 'book_reviews', label: 'Рецензии на книги' }
];

export type JournalEntryKind =
  | 'article'
  | 'announcement'
  | 'program'
  | 'conference_report'
  | 'book_review'
  | 'practical_development';

export interface JournalEntryBase {
  id: string;
  section: JournalSectionId;
  kind: JournalEntryKind;
  title: string;
  authors?: readonly string[];
  year?: number;
  issue?: string;
  pages?: string;
  abstract?: string;
  tags?: readonly string[];
  sourceUrl?: string;
  doi?: string;
}

export interface JournalArticle extends JournalEntryBase {
  kind: 'article';
}

export interface JournalAnnouncement extends JournalEntryBase {
  kind: 'announcement';
  date?: string;
  audience?: string;
}

export interface JournalProgram extends JournalEntryBase {
  kind: 'program';
  countries?: readonly string[];
  direction?: string;
}

export interface JournalConferenceReport extends JournalEntryBase {
  kind: 'conference_report';
  event?: string;
  location?: string;
}

export interface JournalBookReview extends JournalEntryBase {
  kind: 'book_review';
  bookTitle?: string;
  bookAuthor?: string;
}

export interface JournalPracticalDevelopment extends JournalEntryBase {
  kind: 'practical_development';
  application?: string;
  result?: string;
}

export type JournalEntry =
  | JournalArticle
  | JournalAnnouncement
  | JournalProgram
  | JournalConferenceReport
  | JournalBookReview
  | JournalPracticalDevelopment;

export const JOURNAL_ENTRIES: readonly JournalEntry[] = [
  // --- Автоматизация проектирования ---
  {
    id: 'ji_auto_001',
    section: 'automation_design',
    kind: 'article',
    title: 'Автоматизированные системы проектирования складских мезонинов',
    authors: ['Иванов А.П.', 'Петров С.В.'],
    year: 2024,
    issue: '№ 3 (47)',
    pages: '45–58',
    abstract: 'Подходы к автоматизации проектирования многоуровневых стеллажных конструкций с интеграцией WMS/WCS.',
    tags: ['мезонин', 'WMS', 'проектирование'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2024/3/ji_auto_001'
  },
  {
    id: 'ji_auto_002',
    section: 'automation_design',
    kind: 'article',
    title: 'CAD-интеграция для многоуровневых стеллажных систем',
    authors: ['Смирнова О.Ю.'],
    year: 2025,
    issue: '№ 1 (49)',
    pages: '12–24',
    abstract: 'Перенос проектной документации мезонинных объектов в параметрические CAD-модели.',
    tags: ['CAD', 'стеллажи', 'BIM'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/1/ji_auto_002'
  },
  {
    id: 'ji_auto_003',
    section: 'automation_design',
    kind: 'article',
    title: 'Расчёт несущей способности мезонинных настилов в информационной системе',
    authors: ['Кузнецов Д.М.', 'Орлов М.Ю.'],
    year: 2025,
    issue: '№ 4 (52)',
    pages: '101–115',
    abstract: 'Автоматизация расчётов нагружения и генерация отчётов по прочности настилов.',
    tags: ['расчёт', 'прочность', 'настил'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/4/ji_auto_003'
  },
  // --- Обработка сигналов, изображений и речи ---
  {
    id: 'ji_sig_001',
    section: 'signal_processing',
    kind: 'article',
    title: 'Обработка изображений видеоаналитики на объектах хранения',
    authors: ['Волкова Н.А.'],
    year: 2024,
    issue: '№ 2 (46)',
    pages: '78–90',
    abstract: 'Методы обнаружения объектов на кадрах камер видеонаблюдения склада.',
    tags: ['видеоаналитика', 'обработка изображений'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2024/2/ji_sig_001'
  },
  // --- Математическое моделирование ---
  {
    id: 'ji_math_001',
    section: 'mathematical_modeling',
    kind: 'article',
    title: 'Математическое моделирование потоков грузов на мезонине',
    authors: ['Лебедев П.С.'],
    year: 2024,
    issue: '№ 4 (48)',
    pages: '201–214',
    abstract: 'Очередные модели приёма и выдачи грузов на многоуровневых площадках.',
    tags: ['моделирование', 'очереди', 'логистика'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2024/4/ji_math_001'
  },
  {
    id: 'ji_math_002',
    section: 'mathematical_modeling',
    kind: 'article',
    title: 'Оптимизация размещения ячеек через целевую функцию',
    authors: ['Павлова Е.К.'],
    year: 2025,
    issue: '№ 3 (51)',
    pages: '55–69',
    abstract: 'Целевые функции минимизации пути перемещения грузчика между уровнями.',
    tags: ['оптимизация', 'размещение', 'ячейки'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/3/ji_math_002'
  },
  // --- Информационная безопасность ---
  {
    id: 'ji_sec_001',
    section: 'information_security',
    kind: 'article',
    title: 'Защита данных в распределённых системах управления складом',
    authors: ['Сидорова Е.Н.'],
    year: 2024,
    issue: '№ 4 (48)',
    pages: '112–126',
    abstract: 'Анализ угроз и методов защиты информации в автоматизированных складских комплексах.',
    tags: ['безопасность', 'WMS', 'угрозы'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2024/4/ji_sec_001'
  },
  {
    id: 'ji_sec_002',
    section: 'information_security',
    kind: 'article',
    title: 'Аутентификация сотрудников в автоматизированном комплексе',
    authors: ['Фролов А.В.'],
    year: 2025,
    issue: '№ 2 (50)',
    pages: '167–180',
    abstract: 'Многофакторная аутентификация и управление доступами на объекте.',
    tags: ['аутентификация', 'доступ'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/2/ji_sec_002'
  },
  // --- Распознавание образов ---
  {
    id: 'ji_pat_001',
    section: 'pattern_recognition',
    kind: 'article',
    title: 'Распознавание маркировок грузов компьютерным зрением',
    authors: ['Новиков И.Р.'],
    year: 2025,
    issue: '№ 1 (49)',
    pages: '33–44',
    abstract: 'Обучение нейросети на примерах этикеток и штрихкодов складской номенклатуры.',
    tags: ['компьютерное зрение', 'маркировка', 'нейросети'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/1/ji_pat_001'
  },
  // --- Системы, приборы и устройства ---
  {
    id: 'ji_dev_001',
    section: 'systems_devices',
    kind: 'article',
    title: 'Датчики заполненности ячеек в системе учёта мезонина',
    authors: ['Мельник Т.П.'],
    year: 2024,
    issue: '№ 2 (46)',
    pages: '134–145',
    abstract: 'Разбор проектов беспроводных датчиков и их интеграция с WMS.',
    tags: ['датчики', 'учёт', 'WMS'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2024/2/ji_dev_001'
  },
  // --- Параллельные вычисления ---
  {
    id: 'ji_par_001',
    section: 'parallel_computing',
    kind: 'article',
    title: 'Параллельные вычисления при моделировании потоков на мезонине',
    authors: ['Новикова Т.К.'],
    year: 2025,
    issue: '№ 2 (50)',
    pages: '67–81',
    abstract: 'Моделирование параллельной обработки запросов на приём и выдачу грузов.',
    tags: ['параллелизм', 'моделирование', 'запросы'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/2/ji_par_001'
  },
  {
    id: 'ji_par_002',
    section: 'parallel_computing',
    kind: 'article',
    title: 'Распределённая обработка заказов на кластере склада',
    authors: ['Денисов С.Л.'],
    year: 2025,
    issue: '№ 4 (52)',
    pages: '190–203',
    abstract: 'Балансировка нагрузки между узлами при пиковой приёмке.',
    tags: ['кластер', 'балансировка', 'заказы'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/4/ji_par_002'
  },
  // --- Космические ИТ и геоинформатика ---
  {
    id: 'ji_gis_001',
    section: 'space_geo_it',
    kind: 'article',
    title: 'Геоинформатические системы в планировании складских территорий',
    authors: ['Морозов А.Л.'],
    year: 2025,
    issue: '№ 2 (50)',
    pages: '89–104',
    abstract: 'Использование ГИС для оптимального размещения мезонинных объектов.',
    tags: ['ГИС', 'планирование', 'территория'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/2/ji_gis_001'
  },
  // --- Интеллектуальные системы ---
  {
    id: 'ji_int_001',
    section: 'intelligent_systems',
    kind: 'article',
    title: 'Интеллектуальное управление логистикой на мезонинных площадках',
    authors: ['Козлов Д.Р.', 'Орлов М.Ю.'],
    year: 2025,
    issue: '№ 1 (49)',
    pages: '15–29',
    abstract: 'Применение интеллектуальных систем для оптимизации маршрутов перемещения грузов между уровнями.',
    tags: ['интеллектуальные системы', 'маршруты', 'логистика'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/1/ji_int_001'
  },
  {
    id: 'ji_int_002',
    section: 'intelligent_systems',
    kind: 'article',
    title: 'Прогноз загрузки ячеек на основе истории перемещений',
    authors: ['Зайцева И.В.'],
    year: 2025,
    issue: '№ 3 (51)',
    pages: '70–84',
    abstract: 'Тренировка модели прогноза ocupancy на/archive данных WMS.',
    tags: ['прогноз', 'загрузка', 'история'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2025/3/ji_int_002'
  },
  // --- Прикладные ИТ ---
  {
    id: 'ji_app_001',
    section: 'applied_it',
    kind: 'article',
    title: 'Внедрение WMS на объекте с мезонинным хранением',
    authors: ['Белов Р.Н.'],
    year: 2024,
    issue: '№ 3 (47)',
    pages: '150–164',
    abstract: 'Опыт автоматизации учёта на многоуровневом складе.',
    tags: ['WMS', 'внедрение', 'учёт'],
    sourceUrl: 'https://journal-informatica.example.ru/issues/2024/3/ji_app_001'
  },
  // --- Практические разработки ---
  {
    id: 'ji_pd_001',
    section: 'practical_developments',
    kind: 'practical_development',
    title: 'Модуль учёта ячеек мезонина для складской автоматики',
    authors: ['Отдел автоматизации'],
    year: 2025,
    abstract: 'Готовый к внедрению модуль учёта с веб-интерфейсом и API для WMS.',
    tags: ['разработка', 'модуль', 'API'],
    application: 'Складской учёт',
    result: 'Внедрён на двух пилотных объектах',
    sourceUrl: 'https://journal-informatica.example.ru/developments/ji_pd_001'
  },
  {
    id: 'ji_pd_002',
    section: 'practical_developments',
    kind: 'practical_development',
    title: 'Панель мониторинга загрузки уровней мезонина',
    authors: ['Отдел автоматизации'],
    year: 2024,
    abstract: 'Диспетчерская панель с онлайн-отображением заполненности ячеек по уровням.',
    tags: ['панель', 'мониторинг', 'дашборд'],
    application: 'Диспетчеризация',
    result: 'В эксплуатации',
    sourceUrl: 'https://journal-informatica.example.ru/developments/ji_pd_002'
  },
  // --- Программы ---
  {
    id: 'ji_prog_001',
    section: 'programs',
    kind: 'program',
    title: 'Российско-белорусская программа сотрудничества в области ИТ',
    countries: ['RU', 'BY'],
    direction: 'Информационные технологии и автоматизация',
    year: 2024,
    abstract: 'Совместные проекты по цифровизации логистики и складского оборудования.',
    tags: ['программа', 'RU', 'BY']
  },
  {
    id: 'ji_prog_002',
    section: 'programs',
    kind: 'program',
    title: 'Национальная программа подготовки кадров для цифровой экономики',
    direction: 'Образование и кадры',
    year: 2025,
    abstract: 'Поддержка образовательных программ и переподготовки специалистов ИТ.',
    tags: ['программа', 'кадры', 'образование']
  },
  // --- Объявления ---
  {
    id: 'ji_ann_001',
    section: 'announcements',
    kind: 'announcement',
    title: 'Конференция «Информатика-2025»: приём статей до 1 июня',
    date: '12.05.2025',
    audience: 'Авторам и исследователям',
    abstract: 'Принимаются статьи по всем рубрикам журнала. Публикация бесплатная.',
    tags: ['конференция', 'приём статей'],
    sourceUrl: 'https://journal-informatica.example.ru/announcements/ji_ann_001'
  },
  {
    id: 'ji_ann_002',
    section: 'announcements',
    kind: 'announcement',
    title: 'Выпуск журнала № 4 (52) доступен в открытом доступе',
    date: '03.10.2025',
    audience: 'Читателям',
    abstract: 'Новый выпуск выходит в электронном виде на сайте журнала.',
    tags: ['выпуск', 'доступ']
  },
  // --- Отчеты о конференциях ---
  {
    id: 'ji_conf_001',
    section: 'conference_reports',
    kind: 'conference_report',
    title: 'Отчёт о конференции «Современные ИТ в логистике»',
    event: '«Современные ИТ в логистике»',
    location: 'Москва',
    year: 2024,
    authors: ['Редакция журнала'],
    abstract: 'Основные доклады по автоматизации складов, WMS и мезонинным объектам.',
    tags: ['конференция', 'отчёт', 'логистика'],
    sourceUrl: 'https://journal-informatica.example.ru/reports/ji_conf_001'
  },
  {
    id: 'ji_conf_002',
    section: 'conference_reports',
    kind: 'conference_report',
    title: 'Отчёт о научной сессии «Геоинформатика и пространственные данные»',
    event: 'Научная сессия «Геоинформатика и пространственные данные»',
    location: 'Санкт-Петербург',
    year: 2025,
    abstract: 'Доклады по применению ГИС в планировании территорий и объектов.',
    tags: ['ГИС', 'сессия', 'отчёт']
  },
  // --- Рецензии на книги ---
  {
    id: 'ji_rev_001',
    section: 'book_reviews',
    kind: 'book_review',
    title: 'Рецензия: «Базы данных и информационные системы»',
    bookTitle: 'Базы данных и информационные системы',
    bookAuthor: 'Под ред. И.В. Красильщикова',
    authors: ['Редакция журнала'],
    year: 2025,
    abstract: 'Обзор издания для преподавателей и студентов направлений ИТ.',
    tags: ['рецензия', 'книга', 'базы данных']
  },
  {
    id: 'ji_rev_002',
    section: 'book_reviews',
    kind: 'book_review',
    title: 'Рецензия: «Машинное обучение в logistic-системах»',
    bookTitle: 'Машинное обучение в logistic-системах',
    bookAuthor: 'А. С. Петров',
    authors: ['Редакция журнала'],
    year: 2024,
    abstract: 'Практические примеры применения ML на складах и в цепочках поставок.',
    tags: ['рецензия', 'ML', 'логистика']
  }
];

export function getJournalSections(): readonly JournalSectionMeta[] {
  return JOURNAL_SECTIONS;
}

export function getEntriesBySection(sectionId: JournalSectionId): readonly JournalEntry[] {
  return JOURNAL_ENTRIES.filter(entry => entry.section === sectionId);
}

export function getSectionCounts(): Record<JournalSectionId, number> {
  const counts: Record<JournalSectionId, number> = Object.fromEntries(
    JOURNAL_SECTION_IDS.map(id => [id, 0])
  ) as Record<JournalSectionId, number>;
  for (const entry of JOURNAL_ENTRIES) {
    counts[entry.section] += 1;
  }
  return counts;
}

export function getTotalEntryCount(): number {
  return JOURNAL_ENTRIES.length;
}

export function getEntryById(id: string): JournalEntry | undefined {
  return JOURNAL_ENTRIES.find(entry => entry.id === id);
}

export function searchJournalEntries(query: string): readonly JournalEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...JOURNAL_ENTRIES];
  return JOURNAL_ENTRIES.filter(entry => {
    const haystack = [
      entry.id,
      entry.title,
      (entry.authors ?? []).join(' '),
      entry.abstract ?? '',
      (entry.tags ?? []).join(' '),
      entry.sourceUrl ?? ''
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
