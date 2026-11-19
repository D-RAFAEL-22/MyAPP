export type Deflate9 = (bytes: Uint8Array) => number;

export interface Budgets {
  htmlBytes: number;
  deflated: number;
  chatDataBytes: number;
  captionChars: number;
  height320: number;
}

export interface ServiceWords {
  pending?: string;
  failed?: string;
  busy?: string;
  notAllowed?: string;
  ellipsis?: string;
}

export interface ResolvedServiceWords {
  pending: string;
  failed: string;
  busy: string;
  notAllowed: string;
  ellipsis: string;
}

export interface CompileOptions {
  deflate9: Deflate9;
  allowedOrigins: readonly string[];
  botUsername?: string;
  limits?: Partial<Budgets>;
  words?: ServiceWords;
}

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type Priority = 'primary' | 'secondary';

export interface BaseNode {
  id?: string;
  priority?: Priority;
}

export interface StatusBadgeOption {
  label: string;
  tone: BadgeTone;
}

export interface StatusBadgeNode extends BaseNode {
  type: 'StatusBadge';
  bind: string;
  options: Record<string, StatusBadgeOption>;
  value?: string;
}

export interface HeaderNode extends BaseNode {
  type: 'Header';
  title: string;
  subtitle?: string;
  badge?: StatusBadgeNode;
}

export interface TextNode extends BaseNode {
  type: 'Text';
  text: string;
  tone?: 'primary' | 'secondary';
  selectable?: boolean;
  bind?: string;
}

export interface KeyValueRow {
  label: string;
  value: string;
  bind?: string;
}

export interface KeyValueNode extends BaseNode {
  type: 'KeyValue';
  rows: KeyValueRow[];
}

export interface TaskItemNode extends BaseNode {
  type: 'TaskItem';
  num: number | string;
  title: string;
  due?: string;
  meta?: string;
  badge?: StatusBadgeNode;
  action?: string;
}

export interface ListPagerWords {
  prev: string;
  next: string;
  of: string;
}

export interface ListNode extends BaseNode {
  type: 'List';
  items: (TaskItemNode | KeyValueNode)[];
  pageSize?: number;
  pager?: ListPagerWords;
}

export interface TableNode extends BaseNode {
  type: 'Table';
  columns: string[];
  rows: string[][];
  align?: ('start' | 'end')[];
}

export interface ProgressBarNode extends BaseNode {
  type: 'ProgressBar';
  label?: string;
  bind: string;
  value?: number;
}

export interface BarChartItem {
  label: string;
  value: number;
}

export interface BarChartNode extends BaseNode {
  type: 'BarChart';
  bars: BarChartItem[];
  max?: number;
  caption?: string;
}

export interface TabEntry {
  title: string;
  children: WidgetNode[];
}

export interface TabsNode extends BaseNode {
  type: 'Tabs';
  tabs: TabEntry[];
}

export interface AccordionSection {
  title: string;
  children: WidgetNode[];
}

export interface AccordionNode extends BaseNode {
  type: 'Accordion';
  sections: AccordionSection[];
}

export interface RequestButton {
  kind: 'request';
  label: string;
  action: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface LinkButton {
  kind: 'link';
  label: string;
  link: string;
  style?: 'primary' | 'secondary';
}

export interface LocalButton {
  kind: 'local';
  label: string;
  toggles: string;
  labelBack?: string;
  style?: 'primary' | 'secondary';
}

export type WidgetButton = RequestButton | LinkButton | LocalButton;

export interface ButtonRowNode extends BaseNode {
  type: 'ButtonRow';
  buttons: WidgetButton[];
}

export interface DividerNode extends BaseNode {
  type: 'Divider';
}

export interface CardNode extends BaseNode {
  type: 'Card';
  children: WidgetNode[];
}

export type WidgetNode =
  | HeaderNode
  | TextNode
  | StatusBadgeNode
  | KeyValueNode
  | TaskItemNode
  | ListNode
  | TableNode
  | ProgressBarNode
  | BarChartNode
  | TabsNode
  | AccordionNode
  | ButtonRowNode
  | DividerNode;

export type StatePrimitive = string | number | boolean | string[];

export interface WidgetState {
  r: number;
  act?: string[];
  [key: string]: StatePrimitive | undefined;
}

export interface WidgetSpec {
  v: 1;
  root: CardNode;
  state: WidgetState;
  actions?: Record<string, string | null>;
  links?: Record<string, string>;
  caption?: string;
  dir?: 'ltr' | 'rtl';
  lang?: string;
  words?: ServiceWords;
}

export interface CompileSizes {
  utf8Bytes: number;
  deflatedBytes: number;
  chatDataBytes: number;
  captionChars: number;
  predictedHeight320: number;
}

export interface CompileResult {
  html: string;
  chatData: string;
  caption: string;
  sizes: CompileSizes;
  degraded: string[];
  usedCssKeys: string[];
  usedRuntimeKeys: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type WidgetError =
  | { code: 'invalid_spec'; issues: ValidationIssue[] }
  | { code: 'link_not_allowed'; path: string; url: string }
  | { code: 'action_too_long'; path: string; bytes: number }
  | { code: 'chat_data_too_large'; bytes: number }
  | {
      code: 'too_large';
      sizes: CompileSizes;
      degraded: string[];
      reason: 'deflated' | 'html' | 'height';
    };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Bot API 10.4 Widget Types (from docs/telegram/bot-api-10.4-widgets.md)
export interface SendWidgetParams {
  chat_id: number | string;
  message_thread_id?: number;
  html: string;
  width?: number;
  height?: number;
  public_data?: string;
  chat_data?: string;
  caption?: string;
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  show_caption_above_media?: boolean;
  allow_queries?: boolean;
  is_shared?: boolean;
  disable_notification?: boolean;
  protect_content?: boolean;
}

export interface EditMessageWidgetDataParams {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  public_data?: string;
  chat_data?: string;
}

export interface AnswerWidgetQueryParams {
  widget_query_id: string;
  data?: string;
}

export interface WidgetQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat_instance: string;
  data?: string;
}
