import type { RenderPlanOverrides } from './height.ts';
import { LIMITS } from './limits.ts';
import type { ListNode, TextNode, WidgetNode, WidgetSpec } from './types.ts';

export type BudgetFailReason = 'deflated' | 'html' | 'height';

export interface DegradationCandidate {
  step: 'collapse' | 'paginate' | 'truncate';
  nodeId: string;
  label: string;
  appliesTo: (reason: BudgetFailReason, overrides: RenderPlanOverrides) => boolean;
  apply: (overrides: RenderPlanOverrides, truncatedFullTexts: string[]) => void;
}

function collectTextsAndLists(
  nodes: WidgetNode[],
  idMap: WeakMap<object, string>,
  texts: { node: TextNode; id: string; index: number }[],
  lists: { node: ListNode; id: string }[],
) {
  for (const n of nodes) {
    const id = idMap.get(n) ?? '';
    if (n.type === 'Text') {
      texts.push({ node: n, id, index: texts.length });
    } else if (n.type === 'List') {
      lists.push({ node: n, id });
    } else if (n.type === 'Tabs') {
      n.tabs.forEach((t) => collectTextsAndLists(t.children, idMap, texts, lists));
    } else if (n.type === 'Accordion') {
      n.sections.forEach((s) => collectTextsAndLists(s.children, idMap, texts, lists));
    }
  }
}

/**
 * Builds the deterministic sequence of degradation steps per spec §4.7:
 * 1. Collapse Text nodes: secondary priority first, then longest primary texts (except the first Text).
 * 2. Paginate List nodes: reduce pageSize step-by-step down to 4, then 3.
 * 3. Truncate longest Text nodes to progressive character limits (full text preserved in caption).
 *
 * Reason-aware skipping (preserves §4.7 order while avoiding counter-productive steps):
 * - collapse & paginate only help 'height' (wrapping in <details> adds bytes on 'deflated'/'html').
 * - truncate on an already-collapsed Text only helps 'deflated'/'html' (closed <details> height is fixed).
 * Action buttons, ButtonRow, and Header.title are NEVER dropped.
 */
export function buildDegradationPlan(
  spec: WidgetSpec,
  idMap: WeakMap<object, string>,
): DegradationCandidate[] {
  const texts: { node: TextNode; id: string; index: number }[] = [];
  const lists: { node: ListNode; id: string }[] = [];
  collectTextsAndLists(spec.root.children, idMap, texts, lists);

  const plan: DegradationCandidate[] = [];

  // Step 1: Collapse secondary texts first, then longest primary texts (except index 0)
  const secondaryTexts = texts
    .filter((t) => t.node.priority === 'secondary' && t.node.text.length > 70)
    .sort((a, b) => b.node.text.length - a.node.text.length);

  for (const t of secondaryTexts) {
    plan.push({
      step: 'collapse',
      nodeId: t.id,
      label: `collapse:${t.id}`,
      appliesTo: (reason, overrides) => reason === 'height' && !overrides.collapsedTextIds.has(t.id),
      apply: (overrides) => {
        overrides.collapsedTextIds.add(t.id);
      },
    });
  }

  const primaryCollapsible = texts
    .filter((t) => t.node.priority !== 'secondary' && t.index > 0 && t.node.text.length > 90)
    .sort((a, b) => b.node.text.length - a.node.text.length);

  for (const t of primaryCollapsible) {
    plan.push({
      step: 'collapse',
      nodeId: t.id,
      label: `collapse:${t.id}`,
      appliesTo: (reason, overrides) => reason === 'height' && !overrides.collapsedTextIds.has(t.id),
      apply: (overrides) => {
        overrides.collapsedTextIds.add(t.id);
      },
    });
  }

  // Step 2: Paginate Lists (5 -> 4 -> 3)
  for (const l of lists) {
    const startSize = l.node.pageSize ?? LIMITS.listDefaultPageSize;
    if (l.node.items.length > 4 && startSize >= 5) {
      plan.push({
        step: 'paginate',
        nodeId: l.id,
        label: `paginate:${l.id}:4`,
        appliesTo: (reason) => reason === 'height',
        apply: (overrides) => {
          overrides.listPageSizes.set(l.id, 4);
        },
      });
    }
    if (l.node.items.length > 3 && startSize >= 4) {
      plan.push({
        step: 'paginate',
        nodeId: l.id,
        label: `paginate:${l.id}:3`,
        appliesTo: (reason) => reason === 'height',
        apply: (overrides) => {
          overrides.listPageSizes.set(l.id, 3);
        },
      });
    }
  }

  // Step 3: Truncate longest texts (full text preserved in caption)
  const truncTargets = [...texts]
    .filter((t) => t.node.text.length > 100)
    .sort((a, b) => b.node.text.length - a.node.text.length);

  const thresholds = [220, 140, 80];
  for (const limit of thresholds) {
    for (const t of truncTargets) {
      if (t.node.text.length > limit) {
        plan.push({
          step: 'truncate',
          nodeId: t.id,
          label: `truncate:${t.id}:${limit}`,
          appliesTo: (reason, overrides) => {
            if (reason === 'height' && overrides.collapsedTextIds.has(t.id)) {
              return false;
            }
            const prev = overrides.truncatedTexts.get(t.id);
            return prev === undefined || limit < prev;
          },
          apply: (overrides, truncatedFullTexts) => {
            overrides.truncatedTexts.set(t.id, limit);
            if (!truncatedFullTexts.includes(t.node.text)) {
              truncatedFullTexts.push(t.node.text);
            }
          },
        });
      }
    }
  }

  return plan;
}
