import { actionTooLong, err, invalidSpec, linkNotAllowed, ok } from './errors.ts';
import { BADGE_TONES, LIMITS } from './limits.ts';
import { utf8Length } from './sanitize.ts';
import type {
  Result,
  ValidationIssue,
  WidgetError,
  WidgetNode,
  WidgetSpec,
} from './types.ts';

export interface ValidateOptions {
  allowedOrigins?: readonly string[];
  botUsername?: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isAllowedLink(urlStr: string, allowedOrigins: readonly string[], botUsername?: string): boolean {
  if (urlStr.length === 0 || urlStr.length > LIMITS.linkUrlMax) return false;
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  // Check t.me/<botUsername>
  if (parsed.origin === 'https://t.me' && botUsername) {
    const cleanBot = botUsername.replace(/^@/, '').toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();
    if (pathLower === `/${cleanBot}` || pathLower.startsWith(`/${cleanBot}/`) || pathLower.startsWith(`/${cleanBot}?`)) {
      return true;
    }
  }

  for (const origin of allowedOrigins) {
    try {
      const allowed = new URL(origin);
      if (allowed.protocol === 'https:' && parsed.origin === allowed.origin) {
        return true;
      }
    } catch {
      // Ignore malformed origin entries
    }
  }
  return false;
}

export function validateSpec(
  input: unknown,
  opts: ValidateOptions = {},
): Result<WidgetSpec, WidgetError> {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return err(invalidSpec([{ path: '$', message: 'Spec must be a JSON object' }]));
  }

  if (input.v !== 1) {
    issues.push({ path: 'v', message: 'Spec version "v" must be 1' });
  }

  if (input.dir !== undefined && input.dir !== 'ltr' && input.dir !== 'rtl') {
    issues.push({ path: 'dir', message: 'dir must be "ltr" or "rtl"' });
  }

  if (input.lang !== undefined && (typeof input.lang !== 'string' || !/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$/.test(input.lang))) {
    issues.push({ path: 'lang', message: 'lang must be a valid BCP 47 language tag (e.g. "ru", "uz", "en")' });
  }

  if (input.caption !== undefined && typeof input.caption !== 'string') {
    issues.push({ path: 'caption', message: 'caption must be a string' });
  }

  // Validate state
  const stateKeys = new Set<string>();
  if (!isPlainObject(input.state)) {
    issues.push({ path: 'state', message: 'state must be a flat object with integer revision "r"' });
  } else {
    if (typeof input.state.r !== 'number' || !Number.isInteger(input.state.r) || input.state.r < 0) {
      issues.push({ path: 'state.r', message: 'state.r is required and must be an integer >= 0' });
    }
    for (const [k, v] of Object.entries(input.state)) {
      if (!LIMITS.stateKeyRegex.test(k)) {
        issues.push({ path: `state.${k}`, message: 'state key must match ^[a-z][a-z0-9_]{0,15}$' });
      }
      stateKeys.add(k);
      if (typeof v === 'string') {
        if (v.length > LIMITS.stateStringMax) {
          issues.push({ path: `state.${k}`, message: `state string exceeds ${LIMITS.stateStringMax} chars` });
        }
      } else if (typeof v === 'number') {
        if (!Number.isInteger(v)) {
          issues.push({ path: `state.${k}`, message: 'state number must be an integer' });
        }
      } else if (typeof v === 'boolean') {
        // valid
      } else if (Array.isArray(v)) {
        if (k !== 'act') {
          issues.push({ path: `state.${k}`, message: 'only "act" may be an array in state' });
        } else {
          v.forEach((item, idx) => {
            if (typeof item !== 'string') {
              issues.push({ path: `state.act[${idx}]`, message: 'act items must be action names (strings)' });
            }
          });
        }
      } else {
        issues.push({ path: `state.${k}`, message: 'state value must be string, integer, boolean, or act string[]' });
      }
    }
  }

  // Validate actions
  const actionMap = new Map<string, string | null>();
  if (input.actions !== undefined) {
    if (!isPlainObject(input.actions)) {
      issues.push({ path: 'actions', message: 'actions must be an object mapping action names to string | null' });
    } else {
      for (const [k, v] of Object.entries(input.actions)) {
        if (v === null) {
          actionMap.set(k, null);
        } else if (typeof v === 'string') {
          const bytes = utf8Length(v);
          if (bytes === 0) {
            issues.push({ path: `actions.${k}`, message: 'action payload cannot be empty string (use null to disable)' });
          } else if (bytes > LIMITS.actionBytesMax) {
            return err(actionTooLong(`actions.${k}`, bytes));
          }
          actionMap.set(k, v);
        } else {
          issues.push({ path: `actions.${k}`, message: 'action value must be string or null' });
        }
      }
    }
  }

  // Validate links
  const linkMap = new Map<string, string>();
  if (input.links !== undefined) {
    if (!isPlainObject(input.links)) {
      issues.push({ path: 'links', message: 'links must be an object mapping link names to https URLs' });
    } else {
      for (const [k, v] of Object.entries(input.links)) {
        if (typeof v !== 'string') {
          issues.push({ path: `links.${k}`, message: 'link value must be an https URL string' });
        } else {
          if (opts.allowedOrigins !== undefined) {
            if (!isAllowedLink(v, opts.allowedOrigins, opts.botUsername)) {
              return err(linkNotAllowed(`links.${k}`, v));
            }
          } else {
            // Still verify valid https protocol and <= 256 chars
            try {
              const u = new URL(v);
              if (u.protocol !== 'https:' || v.length > LIMITS.linkUrlMax) {
                return err(linkNotAllowed(`links.${k}`, v));
              }
            } catch {
              return err(linkNotAllowed(`links.${k}`, v));
            }
          }
          linkMap.set(k, v);
        }
      }
    }
  }

  // Validate root Card
  if (!isPlainObject(input.root)) {
    issues.push({ path: 'root', message: 'root must be a Card node object' });
    return err(invalidSpec(issues));
  }
  if (input.root.type !== 'Card') {
    issues.push({ path: 'root.type', message: 'root.type must be "Card"' });
  }
  if (!Array.isArray(input.root.children) || input.root.children.length === 0) {
    issues.push({ path: 'root.children', message: 'Card.children must be a non-empty array of nodes' });
  }

  const seenIds = new Set<string>();
  const toggleRefs: { path: string; targetId: string }[] = [];

  function checkCommon(node: Record<string, unknown>, path: string) {
    if (node.id !== undefined) {
      if (typeof node.id !== 'string' || !LIMITS.idRegex.test(node.id)) {
        issues.push({ path: `${path}.id`, message: 'id must match ^[a-z0-9_-]{1,24}$' });
      } else if (seenIds.has(node.id)) {
        issues.push({ path: `${path}.id`, message: `duplicate node id "${node.id}"` });
      } else {
        seenIds.add(node.id);
      }
    }
    if (node.priority !== undefined && node.priority !== 'primary' && node.priority !== 'secondary') {
      issues.push({ path: `${path}.priority`, message: 'priority must be "primary" or "secondary"' });
    }
  }

  function validateStatusBadge(node: unknown, path: string) {
    if (!isPlainObject(node) || node.type !== 'StatusBadge') {
      issues.push({ path, message: 'Expected StatusBadge node' });
      return;
    }
    checkCommon(node, path);
    if (typeof node.bind !== 'string' || !stateKeys.has(node.bind)) {
      issues.push({ path: `${path}.bind`, message: `bind "${String(node.bind)}" must reference a key in state` });
    }
    if (!isPlainObject(node.options)) {
      issues.push({ path: `${path}.options`, message: 'options must be an object mapping state values to { label, tone }' });
    } else {
      const entries = Object.entries(node.options);
      if (entries.length === 0 || entries.length > LIMITS.badgeOptionsMax) {
        issues.push({
          path: `${path}.options`,
          message: `options must have 1..${LIMITS.badgeOptionsMax} entries`,
        });
      }
      for (const [k, opt] of entries) {
        if (!isPlainObject(opt)) {
          issues.push({ path: `${path}.options.${k}`, message: 'option must be { label, tone }' });
          continue;
        }
        if (typeof opt.label !== 'string' || opt.label.length === 0 || opt.label.length > LIMITS.badgeLabelMax) {
          issues.push({
            path: `${path}.options.${k}.label`,
            message: `label must be 1..${LIMITS.badgeLabelMax} chars`,
          });
        }
        if (typeof opt.tone !== 'string' || !(BADGE_TONES as readonly string[]).includes(opt.tone)) {
          issues.push({
            path: `${path}.options.${k}.tone`,
            message: `tone must be one of ${BADGE_TONES.join(', ')}`,
          });
        }
      }
    }
  }

  function validateNode(node: unknown, path: string, depth: number, insideTabs: boolean) {
    if (depth > LIMITS.maxDepth) {
      issues.push({ path, message: `tree depth exceeds maximum of ${LIMITS.maxDepth}` });
      return;
    }
    if (!isPlainObject(node) || typeof node.type !== 'string') {
      issues.push({ path, message: 'Node must be an object with a string "type"' });
      return;
    }

    checkCommon(node, path);

    switch (node.type) {
      case 'Card':
        issues.push({ path, message: 'Card may only appear at root' });
        break;

      case 'Header':
        if (typeof node.title !== 'string' || node.title.length === 0 || node.title.length > LIMITS.headerTitleMax) {
          issues.push({ path: `${path}.title`, message: `Header.title must be 1..${LIMITS.headerTitleMax} chars` });
        }
        if (node.subtitle !== undefined) {
          if (typeof node.subtitle !== 'string' || node.subtitle.length > LIMITS.headerSubtitleMax) {
            issues.push({
              path: `${path}.subtitle`,
              message: `Header.subtitle must be <= ${LIMITS.headerSubtitleMax} chars`,
            });
          }
        }
        if (node.badge !== undefined) {
          validateStatusBadge(node.badge, `${path}.badge`);
        }
        break;

      case 'Text':
        if (typeof node.text !== 'string' || node.text.length === 0) {
          issues.push({ path: `${path}.text`, message: 'Text.text must be a non-empty string' });
        } else if (node.text.length > LIMITS.textMax) {
          issues.push({ path: `${path}.text`, message: `Text.text exceeds ${LIMITS.textMax} chars` });
        }
        if (node.tone !== undefined && node.tone !== 'primary' && node.tone !== 'secondary') {
          issues.push({ path: `${path}.tone`, message: 'Text.tone must be "primary" or "secondary"' });
        }
        if (node.bind !== undefined && (typeof node.bind !== 'string' || !stateKeys.has(node.bind))) {
          issues.push({ path: `${path}.bind`, message: `bind "${String(node.bind)}" must reference a key in state` });
        }
        break;

      case 'StatusBadge':
        validateStatusBadge(node, path);
        break;

      case 'KeyValue':
        if (!Array.isArray(node.rows) || node.rows.length === 0 || node.rows.length > LIMITS.kvRowsMax) {
          issues.push({ path: `${path}.rows`, message: `KeyValue.rows must have 1..${LIMITS.kvRowsMax} rows` });
        } else {
          node.rows.forEach((row, i) => {
            const rp = `${path}.rows[${i}]`;
            if (!isPlainObject(row)) {
              issues.push({ path: rp, message: 'row must be { label, value, bind? }' });
              return;
            }
            if (typeof row.label !== 'string' || row.label.length === 0 || row.label.length > LIMITS.kvLabelMax) {
              issues.push({ path: `${rp}.label`, message: `label must be 1..${LIMITS.kvLabelMax} chars` });
            }
            if (typeof row.value !== 'string' || row.value.length > LIMITS.kvValueMax) {
              issues.push({ path: `${rp}.value`, message: `value must be <= ${LIMITS.kvValueMax} chars` });
            }
            if (row.bind !== undefined && (typeof row.bind !== 'string' || !stateKeys.has(row.bind))) {
              issues.push({ path: `${rp}.bind`, message: `bind "${String(row.bind)}" must reference a key in state` });
            }
          });
        }
        break;

      case 'TaskItem':
        if (typeof node.num !== 'number' && typeof node.num !== 'string') {
          issues.push({ path: `${path}.num`, message: 'TaskItem.num must be a number or short string' });
        }
        if (typeof node.title !== 'string' || node.title.length === 0 || node.title.length > LIMITS.taskTitleMax) {
          issues.push({ path: `${path}.title`, message: `TaskItem.title must be 1..${LIMITS.taskTitleMax} chars` });
        }
        if (node.due !== undefined && (typeof node.due !== 'string' || node.due.length > LIMITS.taskMetaMax)) {
          issues.push({ path: `${path}.due`, message: `TaskItem.due must be <= ${LIMITS.taskMetaMax} chars` });
        }
        if (node.meta !== undefined && (typeof node.meta !== 'string' || node.meta.length > LIMITS.taskMetaMax)) {
          issues.push({ path: `${path}.meta`, message: `TaskItem.meta must be <= ${LIMITS.taskMetaMax} chars` });
        }
        if (node.badge !== undefined) {
          validateStatusBadge(node.badge, `${path}.badge`);
        }
        if (node.action !== undefined) {
          if (typeof node.action !== 'string' || !actionMap.has(node.action)) {
            issues.push({ path: `${path}.action`, message: `action "${String(node.action)}" not found in actions` });
          }
        }
        break;

      case 'List':
        if (!Array.isArray(node.items) || node.items.length === 0 || node.items.length > LIMITS.listItemsMax) {
          issues.push({ path: `${path}.items`, message: `List.items must have 1..${LIMITS.listItemsMax} items` });
        } else {
          node.items.forEach((item, i) => {
            if (!isPlainObject(item) || (item.type !== 'TaskItem' && item.type !== 'KeyValue')) {
              issues.push({ path: `${path}.items[${i}]`, message: 'List items must be TaskItem or KeyValue' });
            } else {
              validateNode(item, `${path}.items[${i}]`, depth + 1, insideTabs);
            }
          });
        }
        if (node.pageSize !== undefined) {
          if (
            typeof node.pageSize !== 'number' ||
            !Number.isInteger(node.pageSize) ||
            node.pageSize < LIMITS.listPageSizeMin ||
            node.pageSize > LIMITS.listPageSizeMax
          ) {
            issues.push({
              path: `${path}.pageSize`,
              message: `List.pageSize must be an integer between ${LIMITS.listPageSizeMin} and ${LIMITS.listPageSizeMax}`,
            });
          }
        }
        break;

      case 'Table':
        if (!Array.isArray(node.columns) || node.columns.length === 0 || node.columns.length > LIMITS.tableColsMax) {
          issues.push({ path: `${path}.columns`, message: `Table.columns must have 1..${LIMITS.tableColsMax} columns` });
        } else {
          node.columns.forEach((col, ci) => {
            if (typeof col !== 'string' || col.length > LIMITS.tableCellMax) {
              issues.push({ path: `${path}.columns[${ci}]`, message: `column header must be <= ${LIMITS.tableCellMax} chars` });
            }
          });
        }
        if (!Array.isArray(node.rows) || node.rows.length === 0 || node.rows.length > LIMITS.tableRowsMax) {
          issues.push({ path: `${path}.rows`, message: `Table.rows must have 1..${LIMITS.tableRowsMax} rows` });
        } else {
          const colCount = Array.isArray(node.columns) ? node.columns.length : 0;
          node.rows.forEach((row, ri) => {
            if (!Array.isArray(row) || row.length !== colCount) {
              issues.push({ path: `${path}.rows[${ri}]`, message: `row must have exactly ${colCount} cells` });
            } else {
              row.forEach((cell, ci) => {
                if (typeof cell !== 'string' || cell.length > LIMITS.tableCellMax) {
                  issues.push({
                    path: `${path}.rows[${ri}][${ci}]`,
                    message: `cell must be string <= ${LIMITS.tableCellMax} chars`,
                  });
                }
              });
            }
          });
        }
        break;

      case 'ProgressBar':
        if (typeof node.bind !== 'string' || !stateKeys.has(node.bind)) {
          issues.push({ path: `${path}.bind`, message: `bind "${String(node.bind)}" must reference a key in state` });
        }
        if (node.value !== undefined && (typeof node.value !== 'number' || node.value < 0 || node.value > 100)) {
          issues.push({ path: `${path}.value`, message: 'ProgressBar.value must be 0..100' });
        }
        if (node.label !== undefined && (typeof node.label !== 'string' || node.label.length > LIMITS.headerTitleMax)) {
          issues.push({ path: `${path}.label`, message: `ProgressBar.label must be <= ${LIMITS.headerTitleMax} chars` });
        }
        break;

      case 'BarChart':
        if (!Array.isArray(node.bars) || node.bars.length === 0 || node.bars.length > LIMITS.barChartBarsMax) {
          issues.push({ path: `${path}.bars`, message: `BarChart.bars must have 1..${LIMITS.barChartBarsMax} bars` });
        } else {
          node.bars.forEach((bar, bi) => {
            if (!isPlainObject(bar)) {
              issues.push({ path: `${path}.bars[${bi}]`, message: 'bar must be { label, value }' });
              return;
            }
            if (typeof bar.label !== 'string' || bar.label.length === 0 || bar.label.length > LIMITS.barChartLabelMax) {
              issues.push({
                path: `${path}.bars[${bi}].label`,
                message: `bar label must be 1..${LIMITS.barChartLabelMax} chars`,
              });
            }
            if (typeof bar.value !== 'number' || !Number.isFinite(bar.value) || bar.value < 0) {
              issues.push({ path: `${path}.bars[${bi}].value`, message: 'bar value must be a finite number >= 0' });
            }
          });
        }
        break;

      case 'Tabs':
        if (insideTabs) {
          issues.push({ path, message: 'Tabs cannot be nested inside Tabs' });
        }
        if (!Array.isArray(node.tabs) || node.tabs.length < 2 || node.tabs.length > LIMITS.tabsMax) {
          issues.push({ path: `${path}.tabs`, message: `Tabs.tabs must have 2..${LIMITS.tabsMax} tabs` });
        } else {
          node.tabs.forEach((tab, ti) => {
            const tp = `${path}.tabs[${ti}]`;
            if (!isPlainObject(tab)) {
              issues.push({ path: tp, message: 'tab must be { title, children }' });
              return;
            }
            if (typeof tab.title !== 'string' || tab.title.length === 0 || tab.title.length > LIMITS.tabTitleMax) {
              issues.push({ path: `${tp}.title`, message: `tab title must be 1..${LIMITS.tabTitleMax} chars` });
            }
            if (!Array.isArray(tab.children) || tab.children.length === 0) {
              issues.push({ path: `${tp}.children`, message: 'tab children must be non-empty' });
            } else {
              tab.children.forEach((child, ci) => validateNode(child, `${tp}.children[${ci}]`, depth + 1, true));
            }
          });
        }
        break;

      case 'Accordion':
        if (
          !Array.isArray(node.sections) ||
          node.sections.length === 0 ||
          node.sections.length > LIMITS.accordionSectionsMax
        ) {
          issues.push({
            path: `${path}.sections`,
            message: `Accordion.sections must have 1..${LIMITS.accordionSectionsMax} sections`,
          });
        } else {
          node.sections.forEach((sec, si) => {
            const sp = `${path}.sections[${si}]`;
            if (!isPlainObject(sec)) {
              issues.push({ path: sp, message: 'section must be { title, children }' });
              return;
            }
            if (typeof sec.title !== 'string' || sec.title.length === 0 || sec.title.length > LIMITS.accordionTitleMax) {
              issues.push({
                path: `${sp}.title`,
                message: `section title must be 1..${LIMITS.accordionTitleMax} chars`,
              });
            }
            if (!Array.isArray(sec.children) || sec.children.length === 0) {
              issues.push({ path: `${sp}.children`, message: 'section children must be non-empty' });
            } else {
              sec.children.forEach((child, ci) => validateNode(child, `${sp}.children[${ci}]`, depth + 1, insideTabs));
            }
          });
        }
        break;

      case 'ButtonRow':
        if (
          !Array.isArray(node.buttons) ||
          node.buttons.length < LIMITS.buttonRowMin ||
          node.buttons.length > LIMITS.buttonRowMax
        ) {
          issues.push({
            path: `${path}.buttons`,
            message: `ButtonRow.buttons must have ${LIMITS.buttonRowMin}..${LIMITS.buttonRowMax} buttons`,
          });
        } else {
          let hasRequest = false;
          let primaryCount = 0;
          node.buttons.forEach((btn, bi) => {
            const bp = `${path}.buttons[${bi}]`;
            if (!isPlainObject(btn)) {
              issues.push({ path: bp, message: 'button must be an object' });
              return;
            }
            if (typeof btn.label !== 'string' || btn.label.length === 0 || btn.label.length > LIMITS.buttonLabelMax) {
              issues.push({ path: `${bp}.label`, message: `button label must be 1..${LIMITS.buttonLabelMax} chars` });
            }
            if (btn.style === 'primary') primaryCount++;

            if (btn.kind === 'request') {
              hasRequest = true;
              if (typeof btn.action !== 'string' || !actionMap.has(btn.action)) {
                issues.push({ path: `${bp}.action`, message: `action "${String(btn.action)}" not found in actions` });
              }
            } else if (btn.kind === 'link') {
              if (typeof btn.link !== 'string' || !linkMap.has(btn.link)) {
                issues.push({ path: `${bp}.link`, message: `link "${String(btn.link)}" not found in links` });
              }
            } else if (btn.kind === 'local') {
              if (typeof btn.toggles !== 'string' || btn.toggles.length === 0) {
                issues.push({ path: `${bp}.toggles`, message: 'local button requires "toggles" node id' });
              } else {
                toggleRefs.push({ path: `${bp}.toggles`, targetId: btn.toggles });
              }
            } else {
              issues.push({ path: `${bp}.kind`, message: 'button kind must be "request", "link", or "local"' });
            }
          });

          if (hasRequest && primaryCount > 1) {
            issues.push({
              path: `${path}.buttons`,
              message: 'ButtonRow with request buttons may have at most one "primary" button',
            });
          }
        }
        break;

      case 'Divider':
        break;

      default:
        issues.push({ path: `${path}.type`, message: `Unknown component type "${node.type}"` });
    }
  }

  checkCommon(input.root, 'root');
  if (Array.isArray(input.root.children)) {
    (input.root.children as WidgetNode[]).forEach((child, i) => {
      validateNode(child, `root.children[${i}]`, 1, false);
    });
  }

  // Verify local button toggle targets exist
  for (const ref of toggleRefs) {
    if (!seenIds.has(ref.targetId)) {
      issues.push({
        path: ref.path,
        message: `toggles target id "${ref.targetId}" does not match any node id in tree`,
      });
    }
  }

  if (issues.length > 0) {
    return err(invalidSpec(issues));
  }

  return ok(input as unknown as WidgetSpec);
}
