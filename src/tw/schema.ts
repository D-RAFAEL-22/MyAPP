import { BADGE_TONES, CATALOG_NODE_TYPES, HARD_BUDGETS, LIMITS } from './limits.ts';

export interface CatalogMeta {
  version: 1;
  components: readonly string[];
  budgets: typeof HARD_BUDGETS;
  limits: typeof LIMITS;
}

export const catalog: CatalogMeta = {
  version: 1,
  components: CATALOG_NODE_TYPES,
  budgets: HARD_BUDGETS,
  limits: LIMITS,
};

export const widgetSpecSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://sayf.tw/schema/widget-spec.v1.json',
  title: 'TW Telegram Widget Spec v1',
  type: 'object',
  required: ['v', 'root', 'state'],
  additionalProperties: false,
  properties: {
    v: { const: 1 },
    dir: { enum: ['ltr', 'rtl'] },
    lang: { type: 'string', pattern: '^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$' },
    caption: { type: 'string', maxLength: HARD_BUDGETS.captionChars },
    state: {
      type: 'object',
      required: ['r'],
      properties: {
        r: { type: 'integer', minimum: 0 },
        act: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: {
        oneOf: [
          { type: 'string', maxLength: LIMITS.stateStringMax },
          { type: 'integer' },
          { type: 'boolean' },
        ],
      },
    },
    actions: {
      type: 'object',
      additionalProperties: {
        oneOf: [{ type: 'string', minLength: 1, maxLength: LIMITS.actionBytesMax }, { type: 'null' }],
      },
    },
    links: {
      type: 'object',
      additionalProperties: { type: 'string', format: 'uri', maxLength: LIMITS.linkUrlMax },
    },
    words: {
      type: 'object',
      properties: {
        pending: { type: 'string' },
        failed: { type: 'string' },
        busy: { type: 'string' },
        notAllowed: { type: 'string' },
        ellipsis: { type: 'string' },
      },
      additionalProperties: false,
    },
    root: {
      type: 'object',
      required: ['type', 'children'],
      properties: {
        type: { const: 'Card' },
        id: { type: 'string', pattern: LIMITS.idRegex.source },
        children: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/$defs/Node' },
        },
      },
      additionalProperties: false,
    },
  },
  $defs: {
    StatusBadge: {
      type: 'object',
      required: ['type', 'bind', 'options'],
      properties: {
        type: { const: 'StatusBadge' },
        id: { type: 'string', pattern: LIMITS.idRegex.source },
        bind: { type: 'string' },
        value: { type: 'string' },
        options: {
          type: 'object',
          minProperties: 1,
          maxProperties: LIMITS.badgeOptionsMax,
          additionalProperties: {
            type: 'object',
            required: ['label', 'tone'],
            properties: {
              label: { type: 'string', minLength: 1, maxLength: LIMITS.badgeLabelMax },
              tone: { enum: [...BADGE_TONES] },
            },
          },
        },
      },
    },
    Node: {
      oneOf: [
        {
          type: 'object',
          required: ['type', 'title'],
          properties: {
            type: { const: 'Header' },
            id: { type: 'string' },
            title: { type: 'string', minLength: 1, maxLength: LIMITS.headerTitleMax },
            subtitle: { type: 'string', maxLength: LIMITS.headerSubtitleMax },
            badge: { $ref: '#/$defs/StatusBadge' },
          },
        },
        {
          type: 'object',
          required: ['type', 'text'],
          properties: {
            type: { const: 'Text' },
            id: { type: 'string' },
            priority: { enum: ['primary', 'secondary'] },
            text: { type: 'string', minLength: 1, maxLength: LIMITS.textMax },
            tone: { enum: ['primary', 'secondary'] },
            selectable: { type: 'boolean' },
            bind: { type: 'string' },
          },
        },
        { $ref: '#/$defs/StatusBadge' },
        {
          type: 'object',
          required: ['type', 'rows'],
          properties: {
            type: { const: 'KeyValue' },
            id: { type: 'string' },
            rows: {
              type: 'array',
              minItems: 1,
              maxItems: LIMITS.kvRowsMax,
              items: {
                type: 'object',
                required: ['label', 'value'],
                properties: {
                  label: { type: 'string', minLength: 1, maxLength: LIMITS.kvLabelMax },
                  value: { type: 'string', maxLength: LIMITS.kvValueMax },
                  bind: { type: 'string' },
                },
              },
            },
          },
        },
        {
          type: 'object',
          required: ['type', 'num', 'title'],
          properties: {
            type: { const: 'TaskItem' },
            id: { type: 'string' },
            num: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
            title: { type: 'string', minLength: 1, maxLength: LIMITS.taskTitleMax },
            due: { type: 'string', maxLength: LIMITS.taskMetaMax },
            meta: { type: 'string', maxLength: LIMITS.taskMetaMax },
            badge: { $ref: '#/$defs/StatusBadge' },
            action: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: ['type', 'items'],
          properties: {
            type: { const: 'List' },
            id: { type: 'string' },
            items: { type: 'array', minItems: 1, maxItems: LIMITS.listItemsMax },
            pageSize: { type: 'integer', minimum: LIMITS.listPageSizeMin, maximum: LIMITS.listPageSizeMax },
            pager: {
              type: 'object',
              properties: { prev: { type: 'string' }, next: { type: 'string' }, of: { type: 'string' } },
            },
          },
        },
        {
          type: 'object',
          required: ['type', 'columns', 'rows'],
          properties: {
            type: { const: 'Table' },
            id: { type: 'string' },
            columns: { type: 'array', minItems: 1, maxItems: LIMITS.tableColsMax },
            rows: { type: 'array', minItems: 1, maxItems: LIMITS.tableRowsMax },
            align: { type: 'array', items: { enum: ['start', 'end'] } },
          },
        },
        {
          type: 'object',
          required: ['type', 'bind'],
          properties: {
            type: { const: 'ProgressBar' },
            id: { type: 'string' },
            label: { type: 'string', maxLength: LIMITS.headerTitleMax },
            bind: { type: 'string' },
            value: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
        {
          type: 'object',
          required: ['type', 'bars'],
          properties: {
            type: { const: 'BarChart' },
            id: { type: 'string' },
            bars: {
              type: 'array',
              minItems: 1,
              maxItems: LIMITS.barChartBarsMax,
              items: {
                type: 'object',
                required: ['label', 'value'],
                properties: {
                  label: { type: 'string', minLength: 1, maxLength: LIMITS.barChartLabelMax },
                  value: { type: 'number', minimum: 0 },
                },
              },
            },
            max: { type: 'number', minimum: 1 },
            caption: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: ['type', 'tabs'],
          properties: {
            type: { const: 'Tabs' },
            id: { type: 'string' },
            tabs: { type: 'array', minItems: 2, maxItems: LIMITS.tabsMax },
          },
        },
        {
          type: 'object',
          required: ['type', 'sections'],
          properties: {
            type: { const: 'Accordion' },
            id: { type: 'string' },
            sections: { type: 'array', minItems: 1, maxItems: LIMITS.accordionSectionsMax },
          },
        },
        {
          type: 'object',
          required: ['type', 'buttons'],
          properties: {
            type: { const: 'ButtonRow' },
            id: { type: 'string' },
            buttons: { type: 'array', minItems: LIMITS.buttonRowMin, maxItems: LIMITS.buttonRowMax },
          },
        },
        {
          type: 'object',
          required: ['type'],
          properties: {
            type: { const: 'Divider' },
            id: { type: 'string' },
          },
        },
      ],
    },
  },
} as const;

export function promptGuide(cat: CatalogMeta = catalog): string {
  return [
    '# TW — Telegram Bot API 10.4 Widget Spec v1 Guide',
    '',
    'Output strictly valid JSON matching widget-spec.v1.json. Never output raw HTML, CSS, or JS.',
    '',
    '## Hard Budgets',
    `- Compiled HTML: <= ${cat.budgets.htmlBytes} UTF-8 bytes`,
    `- zlib level 9 compressed HTML: <= ${cat.budgets.deflated} bytes`,
    `- chat_data JSON: <= ${cat.budgets.chatDataBytes} UTF-8 bytes`,
    `- Fallback caption: <= ${cat.budgets.captionChars} characters`,
    `- Rendered height at 320px width: <= ${cat.budgets.height320} px`,
    '',
    '## Root Structure',
    '- v: 1',
    '- root: { "type": "Card", "children": [...] } (max tree depth: ' + cat.limits.maxDepth + ')',
    '- state: flat object with integer revision "r" >= 0, optional "act": string[] (visible action keys), values are string (<= ' +
      cat.limits.stateStringMax +
      ' chars), integer, or boolean.',
    '- actions: map of action name -> opaque host token (<= ' + cat.limits.actionBytesMax + ' UTF-8 bytes) or null (disabled, omitted from HTML).',
    '- links: map of link name -> https URL (only allowedOrigins or https://t.me/<bot>).',
    '- caption: standalone readable plain-text summary for older Telegram clients.',
    '',
    '## Allowed Components (' + cat.components.length + ')',
    `1. Card — root container only`,
    `2. Header — title (<= ${cat.limits.headerTitleMax}), optional subtitle (<= ${cat.limits.headerSubtitleMax}), optional StatusBadge`,
    `3. Text — text (<= ${cat.limits.textMax}), tone ("primary"|"secondary"), selectable?, bind?, priority ("primary"|"secondary")`,
    `4. StatusBadge — bind (key in state), options (<= ${cat.limits.badgeOptionsMax} entries of { label <= ${cat.limits.badgeLabelMax}, tone: neutral|accent|success|warning|danger })`,
    `5. KeyValue — rows (<= ${cat.limits.kvRowsMax}), each { label <= ${cat.limits.kvLabelMax}, value <= ${cat.limits.kvValueMax}, bind? }`,
    `6. TaskItem — num, title (<= ${cat.limits.taskTitleMax}), due?, meta? (<= ${cat.limits.taskMetaMax}), badge?, action?`,
    `7. List — items (<= ${cat.limits.listItemsMax} TaskItem|KeyValue), pageSize (${cat.limits.listPageSizeMin}..${cat.limits.listPageSizeMax}), pager?`,
    `8. Table — columns (<= ${cat.limits.tableColsMax}), rows (<= ${cat.limits.tableRowsMax}), cell <= ${cat.limits.tableCellMax}, align?`,
    `9. ProgressBar — bind (key in state, 0..100), label?, value?`,
    `10. BarChart — bars (<= ${cat.limits.barChartBarsMax} of { label <= ${cat.limits.barChartLabelMax}, value }), max?, caption?`,
    `11. Tabs — tabs (2..${cat.limits.tabsMax}, title <= ${cat.limits.tabTitleMax}, non-nestable)`,
    `12. Accordion — sections (1..${cat.limits.accordionSectionsMax}, title <= ${cat.limits.accordionTitleMax}, single-open)`,
    `13. ButtonRow — buttons (${cat.limits.buttonRowMin}..${cat.limits.buttonRowMax}; kind: request|link|local; at most 1 primary request button)`,
    `14. Divider — horizontal rule`,
  ].join('\n');
}
