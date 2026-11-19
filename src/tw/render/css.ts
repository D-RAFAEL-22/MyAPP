/**
 * Deterministic Telegram Profile 1 CSS catalog.
 * Rules enforced:
 * - ONLY var(--tg-theme-*) colors (no hardcoded palette colors, no opacity < 1)
 * - No blur box-shadow, no filter, no vh units, no external fonts, no scrollbars
 * - Fixed declaration order; only fragments registered during render are emitted
 */
export const CSS_FRAGMENTS: readonly (readonly [string, string])[] = [
  [
    'base',
    '*{box-sizing:border-box}body{margin:0;padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));background:var(--tg-theme-bg-color);color:var(--tg-theme-text-color);font:14px/1.35 system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%}.c{display:flex;flex-direction:column;gap:8px}[hidden]{display:none!important}',
  ],
  [
    'hdr',
    '.h{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.ht{font-size:15px;font-weight:600;line-height:1.25;word-break:break-word}.hs{font-size:12px;color:var(--tg-theme-hint-color);margin-top:2px;word-break:break-word}',
  ],
  [
    'txt',
    '.tx{font-size:13.5px;line-height:1.38;white-space:pre-line;word-break:break-word}.txs{color:var(--tg-theme-hint-color);font-size:12.5px}.sel{-webkit-user-select:text;user-select:text}',
  ],
  [
    'bdg',
    '.bg{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:11.5px;font-weight:600;white-space:nowrap;flex-shrink:0;background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color)}.bg[data-t=accent]{background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}.bg[data-t=success]{color:var(--tg-theme-accent-text-color);border:1px solid var(--tg-theme-accent-text-color)}.bg[data-t=warning]{color:var(--tg-theme-subtitle-text-color);border:1px solid var(--tg-theme-hint-color)}.bg[data-t=danger]{color:var(--tg-theme-destructive-text-color);border:1px solid var(--tg-theme-destructive-text-color)}',
  ],
  [
    'kv',
    '.kv{display:flex;flex-direction:column;gap:4px}.kr{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:13px}.kl{color:var(--tg-theme-hint-color);flex-shrink:0}.kvv{text-align:right;font-weight:500;word-break:break-word}',
  ],
  [
    'ti',
    '.ti{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;background:var(--tg-theme-secondary-bg-color)}.tn{min-width:24px;height:24px;border-radius:6px;border:0;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);font:600 12px/24px system-ui,sans-serif;text-align:center;padding:0 5px;flex-shrink:0}.tn[data-k]{cursor:pointer}.tb{flex:1;min-width:0}.tt{font-size:13px;font-weight:500;word-break:break-word}.tm{font-size:11.5px;color:var(--tg-theme-hint-color);margin-top:1px}',
  ],
  [
    'lst',
    '.ls{display:flex;flex-direction:column;gap:5px}.pg{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:2px}.pgb{border:1px solid var(--tg-theme-hint-color);background:var(--tg-theme-bg-color);color:var(--tg-theme-text-color);border-radius:6px;padding:4px 10px;font:600 12px system-ui,sans-serif;cursor:pointer}.pgi{font-size:12px;color:var(--tg-theme-hint-color)}',
  ],
  [
    'tbl',
    '.tl{width:100%;border-collapse:collapse;font-size:12px}.tl th{text-align:left;color:var(--tg-theme-hint-color);font-weight:600;padding:4px 6px;border-bottom:1px solid var(--tg-theme-section-separator-color)}.tl td{padding:5px 6px;border-bottom:1px solid var(--tg-theme-secondary-bg-color);word-break:break-word}.tr{text-align:right!important}',
  ],
  [
    'prg',
    '.pr{display:flex;flex-direction:column;gap:4px}.prh{display:flex;justify-content:space-between;font-size:12px;color:var(--tg-theme-hint-color)}.prt{height:7px;border-radius:4px;background:var(--tg-theme-secondary-bg-color);overflow:hidden}.prf{height:100%;border-radius:4px;background:var(--tg-theme-button-color)}',
  ],
  [
    'bar',
    '.bc{display:flex;flex-direction:column;gap:5px}.bcs{display:flex;align-items:flex-end;gap:4px;height:86px;padding-top:14px}.bci{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:3px}.bcv{font-size:10px;color:var(--tg-theme-hint-color);line-height:1}.bcf{width:100%;min-height:3px;border-radius:3px 3px 0 0;background:var(--tg-theme-button-color)}.bcl{font-size:10px;color:var(--tg-theme-hint-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.bcc{font-size:11.5px;color:var(--tg-theme-hint-color)}',
  ],
  [
    'tab',
    '.tbb{display:flex;gap:4px;background:var(--tg-theme-secondary-bg-color);padding:3px;border-radius:8px}.tbt{flex:1;border:0;background:transparent;color:var(--tg-theme-hint-color);font:600 12px system-ui,sans-serif;padding:5px 6px;border-radius:6px;cursor:pointer}.tbt[aria-selected=true]{background:var(--tg-theme-bg-color);color:var(--tg-theme-text-color)}.tbp{display:flex;flex-direction:column;gap:8px;margin-top:6px}',
  ],
  [
    'acc',
    '.ac{display:flex;flex-direction:column;gap:4px}.ad{border-radius:8px;background:var(--tg-theme-secondary-bg-color);padding:6px 10px}.ad summary{cursor:pointer;font-size:13px;font-weight:600;list-style:none;display:flex;justify-content:space-between;align-items:center}.ad summary::after{content:"▸";color:var(--tg-theme-hint-color);font-size:12px}.ad[open] summary::after{content:"▾"}.adb{margin-top:6px;display:flex;flex-direction:column;gap:6px}',
  ],
  [
    'btn',
    '.br{display:flex;gap:6px;flex-wrap:nowrap}.bt{flex:1;min-width:0;border:0;border-radius:8px;padding:8px 10px;font:600 13px/1.2 system-ui,sans-serif;cursor:pointer;background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-accent-text-color);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.btp{background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}.btd{color:var(--tg-theme-destructive-text-color)}.bt[disabled]{color:var(--tg-theme-hint-color);cursor:default}.st{font-size:12px;color:var(--tg-theme-hint-color);min-height:0}',
  ],
  [
    'div',
    '.dv{height:1px;background:var(--tg-theme-section-separator-color);margin:2px 0}',
  ],
];

export function assembleCss(usedKeys: Set<string>): { css: string; orderedKeys: string[] } {
  const orderedKeys: string[] = [];
  let css = '';
  for (const [key, fragment] of CSS_FRAGMENTS) {
    if (usedKeys.has(key)) {
      orderedKeys.push(key);
      css += fragment;
    }
  }
  return { css, orderedKeys };
}
