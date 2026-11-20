import type { WidgetSpec } from './types.ts';

export interface WidgetPreset {
  id: string;
  label: string;
  category: string;
  description: string;
  spec: WidgetSpec;
}

export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: 'task-card',
    label: '6.1 Карточка задачи',
    category: 'Golden §6',
    description: 'Task card with live StatusBadge, ProgressBar, KeyValue details, collapsible "More" section, and stateful action buttons.',
    spec: {
      v: 1,
      lang: 'ru',
      dir: 'ltr',
      state: {
        r: 1,
        status: 'in_progress',
        progress: 40,
        act: ['submit', 'extend'],
      },
      actions: {
        claim: 't:Ab3kQ9:claim',
        submit: 't:Ab3kQ9:submit',
        extend: 't:Ab3kQ9:extend',
      },
      links: {
        open: 'https://acme.sayf.example/w/tasks?open=Ab3kQ9',
      },
      caption: 'Задача «Сверить счёт №418» · В работе · Срок 21.11 · 40%',
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Сверить счёт №418 с поставщиком',
            subtitle: 'Отдел закупок · Исполнитель: А. Каримов',
            badge: {
              type: 'StatusBadge',
              bind: 'status',
              options: {
                new: { label: 'Новая', tone: 'neutral' },
                in_progress: { label: 'В работе', tone: 'accent' },
                done: { label: 'Готово', tone: 'success' },
                overdue: { label: 'Просрочена', tone: 'danger' },
                '*': { label: 'Обновлено в SAYF', tone: 'neutral' },
              },
            },
          },
          {
            type: 'KeyValue',
            rows: [
              { label: 'Срок', value: '21.11, 18:00' },
              { label: 'Контрагент', value: 'ООО «Восток-Трейд»' },
              { label: 'Сумма', value: '148 500 ₽' },
            ],
          },
          {
            type: 'ProgressBar',
            label: 'Выполнение',
            bind: 'progress',
            value: 40,
          },
          {
            type: 'Text',
            id: 'more_info',
            tone: 'secondary',
            text: 'Проверить акт сверки за октябрь, уточнить расхождение по накладной №74 и приложить скан с подписью бухгалтера.',
          },
          {
            type: 'ButtonRow',
            buttons: [
              { kind: 'request', label: 'Взять', action: 'claim' },
              { kind: 'request', label: 'Сдать', action: 'submit', style: 'primary' },
              { kind: 'local', label: 'Ещё', toggles: 'more_info', labelBack: 'Скрыть' },
            ],
          },
          {
            type: 'ButtonRow',
            buttons: [
              { kind: 'request', label: 'Продлить', action: 'extend' },
              { kind: 'link', label: 'Открыть в SAYF', link: 'open' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'day-8-tasks',
    label: '6.2 Список задач (8 кириллицей)',
    category: 'Golden §6',
    description: 'Daily list of 8 Cyrillic tasks with local pagination (5 per page) and tap-to-open widget queries.',
    spec: {
      v: 1,
      lang: 'ru',
      state: { r: 1 },
      actions: {
        t1: 't:101:open',
        t2: 't:102:open',
        t3: 't:103:open',
        t4: 't:104:open',
        t5: 't:105:open',
        t6: 't:106:open',
        t7: 't:107:open',
        t8: 't:108:open',
      },
      caption: 'Задачи на сегодня: 8 задач, 2 просрочены, 3 свободные в отделе.',
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Задачи на сегодня',
            subtitle: 'У вас 8 задач · 2 просрочены · 3 свободные в отделе',
          },
          {
            type: 'List',
            id: 'day_list',
            pageSize: 5,
            pager: { prev: '‹ Назад', next: 'Далее ›', of: ' из ' },
            items: [
              { type: 'TaskItem', num: 1, title: 'Согласовать договор аренды склада', due: 'Просрочено', meta: 'Юротдел', action: 't1' },
              { type: 'TaskItem', num: 2, title: 'Проверить отгрузку по заказу №912', due: 'Просрочено', meta: 'Логистика', action: 't2' },
              { type: 'TaskItem', num: 3, title: 'Подготовить акт сверки за ноябрь', due: 'Сегодня 15:00', meta: 'Бухгалтерия', action: 't3' },
              { type: 'TaskItem', num: 4, title: 'Позвонить ключевому клиенту в Ташкенте', due: 'Сегодня 17:00', meta: 'Продажи', action: 't4' },
              { type: 'TaskItem', num: 5, title: 'Обновить прайс-лист на декабрь', due: 'Завтра 12:00', meta: 'Маркетинг', action: 't5' },
              { type: 'TaskItem', num: 6, title: 'Провести инвентаризацию кассы №2', due: 'Завтра 18:00', meta: 'Розница', action: 't6' },
              { type: 'TaskItem', num: 7, title: 'Утвердить график смен на неделю', due: '22.11', meta: 'HR', action: 't7' },
              { type: 'TaskItem', num: 8, title: 'Собрать обратную связь от дилеров', due: '23.11', meta: 'Продажи', action: 't8' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'decision-card',
    label: '6.3 Карточка решения',
    category: 'Golden §6',
    description: 'Executive approval card with KeyValue facts, collapsible risk analysis Accordion, and Approve / Reject / Edit actions.',
    spec: {
      v: 1,
      lang: 'ru',
      state: {
        r: 1,
        decision: 'pending',
        act: ['approve', 'reject', 'edit'],
      },
      actions: {
        approve: 'd:DEC-88:approve',
        reject: 'd:DEC-88:reject',
        edit: 'd:DEC-88:edit',
      },
      caption: 'Решение DEC-88: Закупка 12 терминалов сбора данных на 420 000 ₽ · Срок ответа: сегодня 19:00',
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Закупка 12 ТСД для нового склада',
            subtitle: 'Инициатор: Д. Рафаэль · Бюджет Q4',
            badge: {
              type: 'StatusBadge',
              bind: 'decision',
              options: {
                pending: { label: 'На подпись', tone: 'warning' },
                approved: { label: 'Одобрено', tone: 'success' },
                rejected: { label: 'Отклонено', tone: 'danger' },
              },
            },
          },
          {
            type: 'KeyValue',
            rows: [
              { label: 'Сумма', value: '420 000 ₽ (в рамках лимита)' },
              { label: 'Риск', value: 'Средний · поставка 5 дней' },
              { label: 'Срок решения', value: 'Сегодня до 19:00' },
              { label: 'Поставщик', value: 'ООО «СканТек» (проверен)' },
            ],
          },
          {
            type: 'Accordion',
            sections: [
              {
                title: 'Подробнее об обосновании и рисках',
                children: [
                  {
                    type: 'Text',
                    text: 'Без терминалов приёмка новой партии задерживается на 2 дня. Альтернативная аренда обходится в 95 000 ₽/мес и не окупается за квартал.',
                  },
                ],
              },
            ],
          },
          {
            type: 'ButtonRow',
            buttons: [
              { kind: 'request', label: 'Одобрить', action: 'approve', style: 'primary' },
              { kind: 'request', label: 'Исправить', action: 'edit' },
              { kind: 'request', label: 'Отклонить', action: 'reject', style: 'danger' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'ai-reply',
    label: '6.4 Ответ ИИ-помощника',
    category: 'Golden §6',
    description: 'Structured assistant answer with Accordion knowledge citations, safe allowlisted links, and Voice request button.',
    spec: {
      v: 1,
      lang: 'ru',
      state: { r: 1 },
      actions: {
        speak: 'v:msg77:speak',
      },
      links: {
        doc1: 'https://acme.sayf.example/kb/reglament-3#4.2',
        bot: 'https://t.me/sayf_demo_bot?start=kb_42',
      },
      caption: 'Помощник отдела продаж: правила предоставления отсрочки платежа (Регламент ред. 3, п. 4.2).',
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Отсрочка платежа для новых клиентов',
            subtitle: 'Помощник отдела продаж · База знаний SAYF',
          },
          {
            type: 'Text',
            selectable: true,
            text: 'Для новых контрагентов базовая отсрочка не превышает 7 календарных дней при сумме поставки до 300 000 ₽ и наличии подписанного договора поручительства.',
          },
          {
            type: 'Accordion',
            sections: [
              {
                title: 'Исключения и согласование свыше 300 000 ₽',
                children: [
                  {
                    type: 'Text',
                    text: 'Лимит до 1 000 000 ₽ и срок до 21 дня согласует финансовый директор через карточку решения после проверки скоринга.',
                  },
                ],
              },
              {
                title: 'Источники (Знания)',
                children: [
                  {
                    type: 'Text',
                    tone: 'secondary',
                    text: '• Регламент продаж · ред. 3 · п. 4.2\n• Кредитная политика · ред. 2 · п. 1.5',
                  },
                ],
              },
            ],
          },
          {
            type: 'ButtonRow',
            buttons: [
              { kind: 'link', label: 'Открыть в SAYF', link: 'doc1', style: 'primary' },
              { kind: 'request', label: 'Голосом', action: 'speak' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'weekly-report',
    label: '6.5 Короткий отчёт (BarChart + Tabs)',
    category: 'Golden §6',
    description: 'Manager digest featuring KPI KeyValue metrics, CSS flexbox BarChart, ProgressBar, and Tabbed breakdown.',
    spec: {
      v: 1,
      lang: 'ru',
      state: { r: 1, plan_pct: 78 },
      caption: 'Отчёт за неделю: закрыто 64 задачи (план 78%), выручка 3.4M ₽.',
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Итоги недели · Отдел продаж',
            subtitle: '13–19 ноября 2026',
          },
          {
            type: 'ProgressBar',
            label: 'Выполнение плана ноября',
            bind: 'plan_pct',
            value: 78,
          },
          {
            type: 'Tabs',
            tabs: [
              {
                title: 'График',
                children: [
                  {
                    type: 'BarChart',
                    caption: 'Закрытые задачи по дням недели',
                    bars: [
                      { label: 'Пн', value: 11 },
                      { label: 'Вт', value: 14 },
                      { label: 'Ср', value: 9 },
                      { label: 'Чт', value: 16 },
                      { label: 'Пт', value: 12 },
                      { label: 'Сб', value: 2 },
                    ],
                  },
                ],
              },
              {
                title: 'Показатели',
                children: [
                  {
                    type: 'KeyValue',
                    rows: [
                      { label: 'Выручка', value: '3 420 000 ₽' },
                      { label: 'Закрыто задач', value: '64 из 70' },
                      { label: 'Средний чек', value: '53 400 ₽' },
                      { label: 'Просрочек', value: '2 (−60%)' },
                    ],
                  },
                ],
              },
              {
                title: 'Команда',
                children: [
                  {
                    type: 'Table',
                    columns: ['Менеджер', 'Сделки', 'План'],
                    align: ['start', 'end', 'end'],
                    rows: [
                      ['А. Каримов', '19', '94%'],
                      ['М. Исмаилова', '16', '88%'],
                      ['С. Петров', '14', '72%'],
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'degrade-demo',
    label: 'Свёртка бюджета (Degradation §4.7)',
    category: 'Edge Cases',
    description: 'Intentionally tall widget (>560px) demonstrating deterministic collapse -> paginate -> truncate degradation while keeping buttons intact.',
    spec: {
      v: 1,
      lang: 'ru',
      state: { r: 1, act: ['confirm'] },
      actions: { confirm: 'dg:1:ok' },
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Сводка инцидента · Склад №3',
            subtitle: 'Авто-свёртка при высоте > 560 px',
          },
          {
            type: 'Text',
            id: 'lead_summary',
            priority: 'primary',
            text: 'В 08:40 зафиксировано расхождение остатков по категории «Холодильное оборудование». Сбой синхронизации ТСД.',
          },
          {
            type: 'Text',
            id: 'secondary_notes',
            priority: 'secondary',
            tone: 'secondary',
            text: 'Подробный журнал ревизии: проверено 42 паллеты в зоне B2, пересчитаны серийные номера компрессоров, сверены электронные накладные за 16–18 ноября. Два терминала переведены на резервную точку доступа Wi-Fi до завершения переиндексации базы.',
          },
          {
            type: 'Text',
            id: 'extra_context',
            priority: 'primary',
            text: 'Рекомендация дежурного инженера: заблокировать автоматическое списание по зоне B2 до 14:00, провести контрольную выгрузку остатков и подтвердить корректирующий акт в системе учёта SAYF.',
          },
          {
            type: 'List',
            id: 'affected_list',
            pageSize: 5,
            items: [
              { type: 'TaskItem', num: 1, title: 'Паллета B2-01 (компрессоры)', due: '11:00' },
              { type: 'TaskItem', num: 2, title: 'Паллета B2-04 (датчики)', due: '11:30' },
              { type: 'TaskItem', num: 3, title: 'Паллета B2-09 (фильтры)', due: '12:00' },
              { type: 'TaskItem', num: 4, title: 'Накладная №8812 с 1С', due: '12:30' },
              { type: 'TaskItem', num: 5, title: 'Прошивка ТСД #07 и #09', due: '13:00' },
              { type: 'TaskItem', num: 6, title: 'Снять блокировку зоны B2', due: '14:00' },
            ],
          },
          {
            type: 'ButtonRow',
            buttons: [
              { kind: 'request', label: 'Подтвердить план', action: 'confirm', style: 'primary' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'security-uzbek',
    label: 'XSS + U+0000 + Oʻzbek + Emoji',
    category: 'Edge Cases',
    description: 'Tests strict escaping of <script>, <img> payloads, null-byte stripping, Uzbek Latin (oʻ/gʻ), and emoji handling.',
    spec: {
      v: 1,
      lang: 'uz',
      state: { r: 1, st: 'ok' },
      actions: {
        check: 'uz:1:ok',
      },
      root: {
        type: 'Card',
        children: [
          {
            type: 'Header',
            title: 'Toʻlov tasdiqlandi ✅ <script>alert(1)</script>',
            subtitle: 'Oʻzbekiston · Gʻazna boʻlimi',
            badge: {
              type: 'StatusBadge',
              bind: 'st',
              options: {
                ok: { label: 'Xavfsiz 🛡️', tone: 'success' },
              },
            },
          },
          {
            type: 'Text',
            text: 'Xavfsizlik tekshiruvi: "><img src=x onerror=alert(1)> va </script><svg onload=1> — barcha belgilar ekranlanadi, U+0000\u0000 olib tashlanadi.',
          },
          {
            type: 'KeyValue',
            rows: [
              { label: 'Mijoz', value: 'Oʻktam Gʻulomov' },
              { label: 'Summa', value: '12 500 000 soʻm' },
            ],
          },
          {
            type: 'ButtonRow',
            buttons: [
              { kind: 'request', label: 'Tekshirish', action: 'check', style: 'primary' },
            ],
          },
        ],
      },
    },
  },
];
