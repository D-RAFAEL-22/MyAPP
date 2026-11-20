/**
 * scripts/weigh.ts — Marginal zlib-9 weight breakdown for TW widgets.
 * Usage: npx tsx scripts/weigh.ts [preset-id]
 *
 * Note: Because DEFLATE (LZ77 + Huffman) shares back-references across blocks,
 * marginal deltas `deflate9(all) - deflate9(without_part)` are non-additive estimates
 * intended to pinpoint which component or layer contributes most to compressed size.
 */
import { compileWidget } from '../src/tw/index.ts';
import { deflate9Node } from '../src/tw/measure-node.ts';
import { WIDGET_PRESETS } from '../src/tw/presets.ts';
import type { WidgetSpec } from '../src/tw/types.ts';

const enc = new TextEncoder();
const z9 = (s: string) => deflate9Node(enc.encode(s));

const filterId = process.argv[2];
const targets = filterId ? WIDGET_PRESETS.filter((p) => p.id === filterId) : WIDGET_PRESETS;

if (targets.length === 0) {
  console.error(`Unknown preset "${filterId}". Available: ${WIDGET_PRESETS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}

const COMPILE_OPTS = {
  deflate9: deflate9Node,
  allowedOrigins: ['https://acme.sayf.example'],
  botUsername: 'sayf_demo_bot',
};

for (const preset of targets) {
  const res = compileWidget(preset.spec, COMPILE_OPTS);
  console.log(`\n=== ${preset.id} (${preset.label}) ===`);
  if (!res.ok) {
    console.log(`  ERROR: ${res.error.code}`, res.error);
    continue;
  }

  const { html, sizes, degraded, usedCssKeys, usedRuntimeKeys } = res.value;
  console.log(
    `  Total: ${sizes.deflatedBytes} B zlib-9 / ${sizes.utf8Bytes} B UTF-8 · chat_data ${sizes.chatDataBytes} B · height ${sizes.predictedHeight320} px`,
  );
  if (degraded.length > 0) {
    console.log(`  Degraded: ${degraded.join(', ')}`);
  }

  // Marginal contribution of <style> and <script>
  const withoutStyle = html.replace(/<style>[\s\S]*?<\/style>/, '');
  const withoutScript = html.replace(/<script>[\s\S]*?<\/script>/, '');
  const styleDelta = sizes.deflatedBytes - z9(withoutStyle);
  const scriptDelta = sizes.deflatedBytes - z9(withoutScript);

  console.log(`  <style>  [${usedCssKeys.join(',')}]: ~${styleDelta} B marginal zlib-9`);
  console.log(`  <script> [${usedRuntimeKeys.join(',') || 'none'}]: ~${scriptDelta} B marginal zlib-9`);

  // Marginal contribution of each top-level child node (when > 1 child)
  const children = preset.spec.root.children;
  if (children.length > 1) {
    console.log('  Top-level nodes (marginal zlib-9, non-additive):');
    const rows: { label: string; delta: number }[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const reducedChildren = children.filter((_, idx) => idx !== i);
      const reducedSpec: WidgetSpec = {
        ...preset.spec,
        root: { ...preset.spec.root, children: reducedChildren },
      };

      // Skip if removing this node breaks a local button's `toggles` target
      const reduced = compileWidget(reducedSpec, COMPILE_OPTS);
      const nodeLabel = `#${i} ${child.type}${child.id ? `(${child.id})` : ''}`;
      if (reduced.ok) {
        rows.push({ label: nodeLabel, delta: sizes.deflatedBytes - reduced.value.sizes.deflatedBytes });
      } else {
        rows.push({ label: `${nodeLabel} [referenced]`, delta: 0 });
      }
    }

    rows.sort((a, b) => b.delta - a.delta);
    for (const r of rows) {
      const bar = '#'.repeat(Math.max(0, Math.min(30, Math.round(r.delta / 15))));
      console.log(`    ${r.label.padEnd(28)} ${String(r.delta).padStart(4)} B  ${bar}`);
    }
  }
}
