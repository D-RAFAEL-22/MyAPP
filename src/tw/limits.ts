import type { Budgets, ResolvedServiceWords } from './types.ts';

export const HARD_BUDGETS: Readonly<Budgets> = Object.freeze({
  htmlBytes: 32768,
  deflated: 3800,
  chatDataBytes: 1024,
  captionChars: 1024,
  height320: 560,
});

export const DEFAULT_SERVICE_WORDS: Readonly<ResolvedServiceWords> = Object.freeze({
  pending: '…',
  failed: '⚠',
  busy: '⏳',
  notAllowed: '⚠',
  ellipsis: '…',
});

export const LIMITS = Object.freeze({
  maxDepth: 4,
  idRegex: /^[a-z0-9_-]{1,24}$/,
  stateKeyRegex: /^[a-z][a-z0-9_]{0,15}$/,
  stateStringMax: 64,
  actionBytesMax: 64,
  linkUrlMax: 256,

  headerTitleMax: 80,
  headerSubtitleMax: 120,
  textMax: 600,
  badgeOptionsMax: 12,
  badgeLabelMax: 24,
  kvRowsMax: 8,
  kvLabelMax: 32,
  kvValueMax: 80,
  taskTitleMax: 80,
  taskMetaMax: 32,
  listItemsMax: 20,
  listPageSizeMin: 3,
  listPageSizeMax: 5,
  listDefaultPageSize: 5,
  tableColsMax: 4,
  tableRowsMax: 8,
  tableCellMax: 25,
  barChartBarsMax: 12,
  barChartLabelMax: 6,
  tabsMax: 3,
  tabTitleMax: 16,
  accordionSectionsMax: 6,
  accordionTitleMax: 60,
  buttonRowMin: 1,
  buttonRowMax: 3,
  buttonLabelMax: 32,
});

export const CATALOG_NODE_TYPES = [
  'Card',
  'Header',
  'Text',
  'StatusBadge',
  'KeyValue',
  'TaskItem',
  'List',
  'Table',
  'ProgressBar',
  'BarChart',
  'Tabs',
  'Accordion',
  'ButtonRow',
  'Divider',
] as const;

export const BADGE_TONES = ['neutral', 'accent', 'success', 'warning', 'danger'] as const;

export function resolveBudgets(overrides?: Partial<Budgets>): Budgets {
  if (!overrides) return { ...HARD_BUDGETS };
  return {
    htmlBytes: Math.min(HARD_BUDGETS.htmlBytes, Math.max(256, overrides.htmlBytes ?? HARD_BUDGETS.htmlBytes)),
    deflated: Math.min(HARD_BUDGETS.deflated, Math.max(256, overrides.deflated ?? HARD_BUDGETS.deflated)),
    chatDataBytes: Math.min(HARD_BUDGETS.chatDataBytes, Math.max(16, overrides.chatDataBytes ?? HARD_BUDGETS.chatDataBytes)),
    captionChars: Math.min(HARD_BUDGETS.captionChars, Math.max(32, overrides.captionChars ?? HARD_BUDGETS.captionChars)),
    height320: Math.min(HARD_BUDGETS.height320, Math.max(120, overrides.height320 ?? HARD_BUDGETS.height320)),
  };
}
