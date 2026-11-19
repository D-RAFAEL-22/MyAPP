import { HARD_BUDGETS } from './limits.ts';
import { safeSliceChars } from './sanitize.ts';
import type { WidgetNode, WidgetSpec } from './types.ts';

function collectTextParts(nodes: WidgetNode[], out: string[]) {
  for (const node of nodes) {
    switch (node.type) {
      case 'Header':
        out.push(node.title);
        if (node.subtitle) out.push(node.subtitle);
        break;
      case 'Text':
        out.push(node.text);
        break;
      case 'KeyValue':
        out.push(node.rows.map((r) => `${r.label}: ${r.value}`).join(' · '));
        break;
      case 'TaskItem':
        out.push(`${node.num}. ${node.title}${node.due ? ` (${node.due})` : ''}`);
        break;
      case 'List':
        collectTextParts(node.items, out);
        break;
      case 'ProgressBar':
        if (node.label) out.push(`${node.label}: ${node.value ?? 0}%`);
        break;
      case 'BarChart':
        if (node.caption) out.push(node.caption);
        break;
      case 'Tabs':
        for (const tab of node.tabs) {
          out.push(tab.title);
          collectTextParts(tab.children, out);
        }
        break;
      case 'Accordion':
        for (const sec of node.sections) {
          out.push(sec.title);
          collectTextParts(sec.children, out);
        }
        break;
      default:
        break;
    }
  }
}

/**
 * Produces a readable fallback caption for older Telegram clients (<= captionChars, always non-empty).
 * If texts were truncated during degradation, their full text is appended when space permits.
 */
export function buildCaption(
  spec: WidgetSpec,
  fullTruncatedTexts: string[],
  maxChars: number = HARD_BUDGETS.captionChars,
  ellipsis: string = '…',
): string {
  let base = spec.caption?.trim() ?? '';
  if (!base) {
    const parts: string[] = [];
    collectTextParts(spec.root.children, parts);
    base = parts.filter(Boolean).join('\n');
  }

  if (fullTruncatedTexts.length > 0) {
    const extra = fullTruncatedTexts.filter((t) => !base.includes(t)).join('\n');
    if (extra) {
      base = base ? `${base}\n\n${extra}` : extra;
    }
  }

  if (!base) {
    base = 'Widget';
  }

  if (base.length <= maxChars) return base;
  const budget = Math.max(1, maxChars - ellipsis.length);
  return safeSliceChars(base, budget) + ellipsis;
}
