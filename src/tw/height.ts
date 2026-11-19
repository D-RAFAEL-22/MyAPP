import { LIMITS } from './limits.ts';
import type { WidgetNode, WidgetSpec } from './types.ts';

export interface RenderPlanOverrides {
  collapsedTextIds: Set<string>;
  listPageSizes: Map<string, number>;
  truncatedTexts: Map<string, number>;
  hiddenToggleTargets: Set<string>;
}

/**
 * Estimates rendered text height at 320px widget width (effective content width ~292px).
 * Conservative slightly-above-actual estimate so real height stays <= 560px.
 */
function textLines(str: string, charsPerLine: number): number {
  if (!str) return 0;
  let total = 0;
  const paragraphs = str.split('\n');
  for (const p of paragraphs) {
    // Cyrillic and wide chars are ~1.08x wider than Latin in system UI fonts
    let weighted = 0;
    for (const ch of p) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp >= 0x1f300) weighted += 1.6;
      else if (cp >= 0x0400 && cp <= 0x04ff) weighted += 1.08;
      else weighted += 1.0;
    }
    total += Math.max(1, Math.ceil(weighted / charsPerLine));
  }
  return total;
}

function estimateNodeHeight(
  node: WidgetNode,
  nodeId: string,
  overrides: RenderPlanOverrides,
  idMap: WeakMap<object, string>,
): number {
  if (overrides.hiddenToggleTargets.has(nodeId)) {
    return 0;
  }

  switch (node.type) {
    case 'Header': {
      const titleH = textLines(node.title, node.badge ? 22 : 30) * 21;
      const subH = node.subtitle ? textLines(node.subtitle, 36) * 16 + 4 : 0;
      return Math.max(26, titleH + subH) + 8;
    }

    case 'Text': {
      if (overrides.collapsedTextIds.has(nodeId)) {
        return 34; // closed <details> summary line
      }
      const limit = overrides.truncatedTexts.get(nodeId);
      const effectiveText = limit !== undefined ? node.text.slice(0, limit) : node.text;
      const lines = textLines(effectiveText, node.tone === 'secondary' ? 40 : 36);
      return lines * 18 + 6;
    }

    case 'StatusBadge':
      return 26;

    case 'KeyValue': {
      let h = 4;
      for (const r of node.rows) {
        const valLines = Math.max(1, textLines(r.value, 24));
        h += Math.max(24, valLines * 17 + 7);
      }
      return h + 4;
    }

    case 'TaskItem': {
      const titleLines = textLines(node.title, 28);
      const metaH = node.due || node.meta ? 16 : 0;
      return Math.max(36, titleLines * 17 + metaH + 14);
    }

    case 'List': {
      const pageSize = overrides.listPageSizes.get(nodeId) ?? node.pageSize ?? LIMITS.listDefaultPageSize;
      const visibleItems = node.items.slice(0, pageSize);
      let h = 0;
      for (const item of visibleItems) {
        const childId = idMap.get(item) ?? '';
        h += estimateNodeHeight(item, childId, overrides, idMap) + 4;
      }
      if (node.items.length > pageSize) {
        h += 34; // pager row
      }
      return h;
    }

    case 'Table': {
      const headerH = 28;
      const rowH = node.rows.length * 26;
      return headerH + rowH + 8;
    }

    case 'ProgressBar':
      return (node.label ? 20 : 0) + 18;

    case 'BarChart':
      return 118 + (node.caption ? 18 : 0);

    case 'Tabs': {
      const barH = 34;
      let maxTabH = 0;
      for (const tab of node.tabs) {
        let th = 0;
        for (const child of tab.children) {
          th += estimateNodeHeight(child, idMap.get(child) ?? '', overrides, idMap) + 8;
        }
        if (th > maxTabH) maxTabH = th;
      }
      return barH + maxTabH;
    }

    case 'Accordion': {
      // Closed summary height for all sections + worst-case 1 open section
      const headersH = node.sections.length * 36;
      let maxOpenBody = 0;
      for (const sec of node.sections) {
        let sh = 0;
        for (const child of sec.children) {
          sh += estimateNodeHeight(child, idMap.get(child) ?? '', overrides, idMap) + 6;
        }
        if (sh > maxOpenBody) maxOpenBody = sh;
      }
      // Include half of largest section if small or conservative full open height
      return headersH + maxOpenBody;
    }

    case 'ButtonRow':
      return 42;

    case 'Divider':
      return 11;
  }
}

export function estimateHeight320(
  spec: WidgetSpec,
  overrides: RenderPlanOverrides,
  idMap: WeakMap<object, string>,
): number {
  // Base vertical padding (12px top + 12px bottom + 14px bubble time safe-area)
  let total = 38;
  const children = spec.root.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const cid = idMap.get(child) ?? '';
    const h = estimateNodeHeight(child, cid, overrides, idMap);
    if (h > 0) {
      total += h + (i > 0 ? 8 : 0);
    }
  }
  return Math.round(total);
}
