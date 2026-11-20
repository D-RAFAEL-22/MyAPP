import { escAttr, escText } from '../escape.ts';
import type { RenderPlanOverrides } from '../height.ts';
import { LIMITS } from '../limits.ts';
import { safeSliceChars } from '../sanitize.ts';
import type {
  ResolvedServiceWords,
  StatusBadgeNode,
  StatusBadgeOption,
  WidgetNode,
  WidgetSpec,
} from '../types.ts';
import { assembleCss } from './css.ts';
import { assembleRuntime } from './runtime.ts';

export interface RenderOutput {
  html: string;
  usedCssKeys: string[];
  usedRuntimeKeys: string[];
}

export function assignDeterministicIds(spec: WidgetSpec): WeakMap<object, string> {
  const idMap = new WeakMap<object, string>();
  let counter = 0;

  function visit(node: WidgetNode) {
    counter++;
    const assigned = node.id ?? `${node.type.toLowerCase()}#${counter}`;
    idMap.set(node, assigned);

    if (node.type === 'List') {
      node.items.forEach(visit);
    } else if (node.type === 'Tabs') {
      node.tabs.forEach((t) => t.children.forEach(visit));
    } else if (node.type === 'Accordion') {
      node.sections.forEach((s) => s.children.forEach(visit));
    }
  }

  spec.root.children.forEach(visit);
  return idMap;
}

export function findToggleTargets(spec: WidgetSpec): Set<string> {
  const targets = new Set<string>();
  function visit(nodes: WidgetNode[]) {
    for (const n of nodes) {
      if (n.type === 'ButtonRow') {
        for (const b of n.buttons) {
          if (b.kind === 'local') targets.add(b.toggles);
        }
      } else if (n.type === 'Tabs') {
        n.tabs.forEach((t) => visit(t.children));
      } else if (n.type === 'Accordion') {
        n.sections.forEach((s) => visit(s.children));
      }
    }
  }
  visit(spec.root.children);
  return targets;
}

export function renderSpecToHtml(
  spec: WidgetSpec,
  overrides: RenderPlanOverrides,
  idMap: WeakMap<object, string>,
  words: ResolvedServiceWords,
): RenderOutput {
  const usedCss = new Set<string>(['base']);
  const usedRuntime = new Set<string>();
  const badgeMaps: Record<string, Record<string, StatusBadgeOption>> = {};
  let badgeMapSeq = 0;
  let hasStatusLine = false;

  const actions = spec.actions ?? {};
  const links = spec.links ?? {};
  const activeActs = Array.isArray(spec.state.act) ? new Set(spec.state.act) : null;

  function renderStatusBadge(badge: StatusBadgeNode): string {
    usedCss.add('bdg');
    usedRuntime.add('bind');
    const bmKey = `m${++badgeMapSeq}`;
    badgeMaps[bmKey] = badge.options;

    const rawVal = spec.state[badge.bind] ?? badge.value ?? '';
    const key = String(rawVal);
    const opt =
      badge.options[key] ??
      badge.options['*'] ??
      Object.values(badge.options)[0] ?? { label: key, tone: 'neutral' };

    return `<span class="bg" data-b="${escAttr(badge.bind)}" data-bm="${bmKey}" data-t="${escAttr(opt.tone)}">${escText(opt.label)}</span>`;
  }

  function renderNode(node: WidgetNode, extraAttrs = ''): string {
    const nodeId = idMap.get(node) ?? '';
    const isToggleTarget = overrides.hiddenToggleTargets.has(nodeId);
    const idAttr = node.id ? ` id="${escAttr(node.id)}"` : '';
    const hiddenAttr = isToggleTarget ? ' hidden' : '';
    const commonAttrs = `${idAttr}${hiddenAttr}${extraAttrs}`;

    switch (node.type) {
      case 'Header': {
        usedCss.add('hdr');
        const badgeHtml = node.badge ? renderStatusBadge(node.badge) : '';
        const subHtml = node.subtitle ? `<div class="hs">${escText(node.subtitle)}</div>` : '';
        return `<div class="h"${commonAttrs}><div><div class="ht">${escText(node.title)}</div>${subHtml}</div>${badgeHtml}</div>`;
      }

      case 'Text': {
        usedCss.add('txt');
        let textVal = node.text;
        if (node.bind && spec.state[node.bind] !== undefined) {
          usedRuntime.add('bind');
          textVal = String(spec.state[node.bind]);
        } else if (node.bind) {
          usedRuntime.add('bind');
        }

        const truncLimit = overrides.truncatedTexts.get(nodeId);
        if (truncLimit !== undefined && textVal.length > truncLimit) {
          textVal = safeSliceChars(textVal, Math.max(1, truncLimit - words.ellipsis.length)) + words.ellipsis;
        }

        if (overrides.collapsedTextIds.has(nodeId)) {
          usedCss.add('acc');
          const preview =
            textVal.length > 58 ? safeSliceChars(textVal, 57) + words.ellipsis : textVal;
          const bindAttr = node.bind ? ` data-b="${escAttr(node.bind)}"` : '';
          return `<details class="ad"${commonAttrs}><summary>${escText(preview)}</summary><div class="adb"><div class="tx${node.tone === 'secondary' ? ' txs' : ''}${node.selectable ? ' sel' : ''}"${bindAttr}>${escText(textVal)}</div></div></details>`;
        }

        const cls = `tx${node.tone === 'secondary' ? ' txs' : ''}${node.selectable ? ' sel' : ''}`;
        const bindAttr = node.bind ? ` data-b="${escAttr(node.bind)}"` : '';
        return `<div class="${cls}"${commonAttrs}${bindAttr}>${escText(textVal)}</div>`;
      }

      case 'StatusBadge':
        return `<div${commonAttrs}>${renderStatusBadge(node)}</div>`;

      case 'KeyValue': {
        usedCss.add('kv');
        const rowsHtml = node.rows
          .map((row) => {
            let val = row.value;
            let bindAttr = '';
            if (row.bind) {
              usedRuntime.add('bind');
              bindAttr = ` data-b="${escAttr(row.bind)}"`;
              if (spec.state[row.bind] !== undefined) {
                val = String(spec.state[row.bind]);
              }
            }
            return `<div class="kr"><span class="kl">${escText(row.label)}</span><span class="kvv"${bindAttr}>${escText(val)}</span></div>`;
          })
          .join('');
        return `<div class="kv"${commonAttrs}>${rowsHtml}</div>`;
      }

      case 'TaskItem': {
        usedCss.add('ti');
        const actionPayload = node.action ? actions[node.action] : null;
        let numHtml: string;
        if (node.action && typeof actionPayload === 'string') {
          usedRuntime.add('req');
          hasStatusLine = true;
          numHtml = `<button type="button" class="tn" data-k="${escAttr(actionPayload)}">${escText(String(node.num))}</button>`;
        } else {
          numHtml = `<span class="tn">${escText(String(node.num))}</span>`;
        }
        const metaParts = [node.due, node.meta].filter(Boolean).join(' · ');
        const metaHtml = metaParts ? `<div class="tm">${escText(metaParts)}</div>` : '';
        const badgeHtml = node.badge ? renderStatusBadge(node.badge) : '';
        return `<div class="ti"${commonAttrs}>${numHtml}<div class="tb"><div class="tt">${escText(node.title)}</div>${metaHtml}</div>${badgeHtml}</div>`;
      }

      case 'List': {
        usedCss.add('lst');
        const pageSize = overrides.listPageSizes.get(nodeId) ?? node.pageSize ?? LIMITS.listDefaultPageSize;
        const needsPager = node.items.length > pageSize;
        const itemsHtml = node.items
          .map((item, idx) => {
            const hideInit = needsPager && idx >= pageSize ? ' hidden' : '';
            return renderNode(item, ` data-li="1"${hideInit}`);
          })
          .join('');

        if (!needsPager) {
          return `<div class="ls"${commonAttrs}>${itemsHtml}</div>`;
        }

        usedRuntime.add('page');
        const prevLbl = node.pager?.prev ?? '‹';
        const nextLbl = node.pager?.next ?? '›';
        const ofLbl = node.pager?.of ?? '/';
        const totalPages = Math.ceil(node.items.length / pageSize);
        const pagerHtml = `<div class="pg"><button type="button" class="pgb" data-pg="p" disabled>${escText(prevLbl)}</button><span class="pgi">1${escText(ofLbl)}${totalPages}</span><button type="button" class="pgb" data-pg="n">${escText(nextLbl)}</button></div>`;
        return `<div class="ls" data-ls="1" data-ps="${pageSize}" data-of="${escAttr(ofLbl)}"${commonAttrs}>${itemsHtml}${pagerHtml}</div>`;
      }

      case 'Table': {
        usedCss.add('tbl');
        const aligns = node.align ?? [];
        const ths = node.columns
          .map((col, i) => `<th${aligns[i] === 'end' ? ' class="tr"' : ''}>${escText(col)}</th>`)
          .join('');
        const trs = node.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, i) => `<td${aligns[i] === 'end' ? ' class="tr"' : ''}>${escText(cell)}</td>`)
                .join('')}</tr>`,
          )
          .join('');
        return `<table class="tl"${commonAttrs}><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
      }

      case 'ProgressBar': {
        usedCss.add('prg');
        usedRuntime.add('bind');
        const raw = spec.state[node.bind] ?? node.value ?? 0;
        const pct = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
        const lbl = node.label ?? '';
        return `<div class="pr" data-b="${escAttr(node.bind)}" data-pr="1"${commonAttrs}><div class="prh"><span>${escText(lbl)}</span><span class="prp">${pct}%</span></div><div class="prt"><div class="prf" style="width:${pct}%"></div></div></div>`;
      }

      case 'BarChart': {
        usedCss.add('bar');
        const maxVal = node.max && node.max > 0 ? node.max : Math.max(1, ...node.bars.map((b) => b.value));
        const barsHtml = node.bars
          .map((b) => {
            const pct = Math.max(4, Math.min(100, Math.round((b.value / maxVal) * 100)));
            return `<div class="bci"><span class="bcv">${escText(String(b.value))}</span><div class="bcf" style="height:${pct}%"></div><span class="bcl">${escText(b.label)}</span></div>`;
          })
          .join('');
        const capHtml = node.caption ? `<div class="bcc">${escText(node.caption)}</div>` : '';
        return `<div class="bc"${commonAttrs}><div class="bcs">${barsHtml}</div>${capHtml}</div>`;
      }

      case 'Tabs': {
        usedCss.add('tab');
        usedRuntime.add('tabs');
        const btns = node.tabs
          .map(
            (t, i) =>
              `<button type="button" class="tbt" aria-selected="${i === 0 ? 'true' : 'false'}">${escText(t.title)}</button>`,
          )
          .join('');
        const panels = node.tabs
          .map(
            (t, i) =>
              `<div class="tbp"${i === 0 ? '' : ' hidden'}>${t.children.map((c) => renderNode(c)).join('')}</div>`,
          )
          .join('');
        return `<div data-tb="1"${commonAttrs}><div class="tbb">${btns}</div>${panels}</div>`;
      }

      case 'Accordion': {
        usedCss.add('acc');
        usedRuntime.add('acc');
        const secs = node.sections
          .map(
            (s) =>
              `<details class="ad"><summary>${escText(s.title)}</summary><div class="adb">${s.children.map((c) => renderNode(c)).join('')}</div></details>`,
          )
          .join('');
        return `<div class="ac" data-ac="1"${commonAttrs}>${secs}</div>`;
      }

      case 'ButtonRow': {
        usedCss.add('btn');
        const renderedBtns: string[] = [];
        let visibleCount = 0;

        for (const btn of node.buttons) {
          const styleCls =
            btn.style === 'primary' ? ' btp' : btn.kind === 'request' && btn.style === 'danger' ? ' btd' : '';

          if (btn.kind === 'request') {
            const payload = actions[btn.action];
            // Null actions are unavailable and MUST NOT enter HTML
            if (payload === null || payload === undefined) continue;
            usedRuntime.add('req');
            hasStatusLine = true;
            if (activeActs) usedRuntime.add('bind');
            const hiddenByAct = Boolean(activeActs && !activeActs.has(btn.action));
            if (!hiddenByAct) visibleCount++;
            const isHidden = hiddenByAct ? ' hidden' : '';
            renderedBtns.push(
              `<button type="button" class="bt${styleCls}" data-k="${escAttr(payload)}" data-ak="${escAttr(btn.action)}"${isHidden}>${escText(btn.label)}</button>`,
            );
          } else if (btn.kind === 'link') {
            const url = links[btn.link];
            if (!url) continue;
            usedRuntime.add('link');
            visibleCount++;
            renderedBtns.push(
              `<button type="button" class="bt${styleCls}" data-u="${escAttr(url)}">${escText(btn.label)}</button>`,
            );
          } else if (btn.kind === 'local') {
            usedRuntime.add('more');
            visibleCount++;
            const backAttr = btn.labelBack
              ? ` data-l1="${escAttr(btn.label)}" data-l2="${escAttr(btn.labelBack)}"`
              : '';
            renderedBtns.push(
              `<button type="button" class="bt${styleCls}" data-tg="${escAttr(btn.toggles)}"${backAttr}>${escText(btn.label)}</button>`,
            );
          }
        }

        if (renderedBtns.length === 0) return '';
        const rowHidden = visibleCount === 0 && !isToggleTarget ? ' hidden' : '';
        return `<div class="br"${commonAttrs}${rowHidden}>${renderedBtns.join('')}</div>`;
      }

      case 'Divider':
        usedCss.add('div');
        return `<div class="dv"${commonAttrs}></div>`;
    }
  }

  const bodyInner = spec.root.children.map((child) => renderNode(child)).join('');
  const statusHtml = hasStatusLine ? `<div class="st" aria-live="polite"></div>` : '';

  if (spec.state.act) {
    usedRuntime.add('bind');
  }

  const { css, orderedKeys: usedCssKeys } = assembleCss(usedCss);
  const { js, orderedKeys: usedRuntimeKeys } = assembleRuntime({
    usedChunks: usedRuntime,
    badgeMaps,
    words,
  });

  const dirAttr = spec.dir ? ` dir="${escAttr(spec.dir)}"` : '';
  const langAttr = spec.lang ? ` lang="${escAttr(spec.lang)}"` : '';
  const scriptTag = js ? `<script>${js}</script>` : '';

  const html = `<style>${css}</style><div class="c"${dirAttr}${langAttr}>${bodyInner}${statusHtml}</div>${scriptTag}`;

  return { html, usedCssKeys, usedRuntimeKeys };
}
