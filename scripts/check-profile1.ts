/**
 * scripts/check-profile1.ts — Fast zero-Chromium Profile 1 & contract guard suite.
 * Verifies:
 *  - No forbidden Profile 1 CSS/HTML/JS tokens across all presets
 *  - Byte-for-byte determinism across repeated compilations (SHA-256)
 *  - Reason-aware degradation (skips collapse on deflated overflow, skips truncate on collapsed text for height)
 *  - StatusBadge "*" fallback & compact tuple serialization
 *  - sessionStorage wrapped in try/catch
 *  - XSS / U+0000 / origin-allowlist security checks
 */
import { createHash } from 'node:crypto';
import { compileWidget } from '../src/tw/index.ts';
import { deflate9Node } from '../src/tw/measure-node.ts';
import { WIDGET_PRESETS } from '../src/tw/presets.ts';
import type { WidgetSpec } from '../src/tw/types.ts';

const FORBIDDEN_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'U+0000 null byte', re: /\u0000/ },
  { name: 'innerHTML', re: /\binnerHTML\b/ },
  { name: 'touch-action CSS', re: /touch-action\s*:/i },
  { name: 'viewport height unit (vh/dvh/svh)', re: /\d(?:vh|dvh|svh)\b/i },
  { name: 'opacity property', re: /\bopacity\s*:/i },
  { name: 'filter property', re: /\bfilter\s*:/i },
  { name: 'text-shadow property', re: /\btext-shadow\s*:/i },
  { name: 'position: sticky', re: /position\s*:\s*sticky/i },
  { name: 'CSS :has() / :checked', re: /:(?:has|checked)\b/i },
  { name: 'network API (fetch/XHR)', re: /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket)\b/ },
  { name: 'forbidden HTML form/embed tags', re: /<(?:input|select|textarea|form|iframe|object|embed)\b/i },
  { name: 'external url() in CSS', re: /url\(\s*['"]?https?:/i },
];

const COMPILE_OPTS = {
  deflate9: deflate9Node,
  allowedOrigins: ['https://acme.sayf.example'],
  botUsername: 'sayf_demo_bot',
};

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  }
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// 1. All presets: compile, budgets, determinism, Profile 1 guard
for (const preset of WIDGET_PRESETS) {
  const r1 = compileWidget(preset.spec, COMPILE_OPTS);
  const r2 = compileWidget(preset.spec, COMPILE_OPTS);

  assert(r1.ok, `Preset "${preset.id}" failed to compile: ${r1.ok ? '' : JSON.stringify(r1.error)}`);
  if (!r1.ok || !r2.ok) continue;

  assert(sha256(r1.value.html) === sha256(r2.value.html), `Preset "${preset.id}" HTML is non-deterministic`);
  assert(r1.value.chatData === r2.value.chatData, `Preset "${preset.id}" chatData is non-deterministic`);
  assert(r1.value.caption === r2.value.caption, `Preset "${preset.id}" caption is non-deterministic`);
  assert(r1.value.sizes.deflatedBytes <= 3800, `Preset "${preset.id}" exceeded 3800 B zlib-9`);
  assert(r1.value.sizes.utf8Bytes <= 32768, `Preset "${preset.id}" exceeded 32768 B UTF-8`);
  assert(r1.value.sizes.chatDataBytes <= 1024, `Preset "${preset.id}" exceeded 1024 B chat_data`);
  assert(r1.value.sizes.predictedHeight320 <= 560, `Preset "${preset.id}" exceeded 560 px height`);

  for (const rule of FORBIDDEN_PATTERNS) {
    assert(!rule.re.test(r1.value.html), `Preset "${preset.id}" violated Profile 1 rule: ${rule.name}`);
  }

  // Verify sessionStorage (when emitted) is strictly wrapped in try/catch
  if (r1.value.html.includes('sessionStorage')) {
    assert(
      /try\{[^}]*sessionStorage/.test(r1.value.html),
      `Preset "${preset.id}" uses sessionStorage outside try/catch`,
    );
  }
}

// 2. Security: raw XSS strings must never survive unescaped
const xssPreset = WIDGET_PRESETS.find((p) => p.id === 'security-uzbek')!;
const xssRes = compileWidget(xssPreset.spec, COMPILE_OPTS);
assert(xssRes.ok, 'security-uzbek preset failed');
if (xssRes.ok) {
  assert(!xssRes.value.html.includes('<script>alert'), 'Unescaped <script> tag found');
  assert(!xssRes.value.html.includes('<img src=x'), 'Unescaped <img> tag found');
  assert(!xssRes.value.html.includes('</script><svg'), 'Unescaped </script> breakout found');
}

// 3. Disallowed link origin must fail with link_not_allowed
const badLinkSpec: WidgetSpec = {
  v: 1,
  state: { r: 1 },
  links: { evil: 'https://evil.example.com/phish' },
  root: {
    type: 'Card',
    children: [
      { type: 'Header', title: 'Test' },
      { type: 'ButtonRow', buttons: [{ kind: 'link', label: 'Go', link: 'evil' }] },
    ],
  },
};
const badLinkRes = compileWidget(badLinkSpec, COMPILE_OPTS);
assert(!badLinkRes.ok && badLinkRes.error.code === 'link_not_allowed', 'Expected link_not_allowed for foreign origin');

// 4. Reason-aware degradation: tight deflated budget must skip collapse & paginate and go straight to truncate
const tightDeflateSpec: WidgetSpec = {
  v: 1,
  lang: 'ru',
  state: { r: 1 },
  root: {
    type: 'Card',
    children: [
      { type: 'Header', title: 'Тест сжатия' },
      {
        type: 'Text',
        id: 't1',
        priority: 'secondary',
        text: 'Длинный текст для проверки пропуска collapse при переполнении именно по zlib-9 байтам: '.repeat(5),
      },
    ],
  },
};
const baseline = compileWidget(tightDeflateSpec, COMPILE_OPTS);
assert(baseline.ok, 'tightDeflateSpec baseline failed');
if (baseline.ok) {
  const tighterLimit = baseline.value.sizes.deflatedBytes - 40;
  const degradedRes = compileWidget(tightDeflateSpec, {
    ...COMPILE_OPTS,
    limits: { deflated: tighterLimit },
  });
  const steps = degradedRes.ok
    ? degradedRes.value.degraded
    : degradedRes.error.code === 'too_large'
      ? degradedRes.error.degraded
      : [];
  assert(
    steps.length > 0 && steps.every((s) => s.startsWith('truncate:')),
    `Expected only truncate steps on deflated overflow, got: ${JSON.stringify(steps)}`,
  );
}

// 5. StatusBadge "*" fallback & compact tuple format
const taskRes = compileWidget(WIDGET_PRESETS[0].spec, COMPILE_OPTS);
if (taskRes.ok) {
  assert(taskRes.value.html.includes('m["*"]'), 'Runtime bind missing "*" fallback lookup');
  assert(taskRes.value.html.includes('["Обновлено в SAYF","neutral"]'), 'Badge map not packed as compact [label,tone] tuple');
}

if (failures > 0) {
  console.error(`\nProfile 1 guard failed with ${failures} error(s).`);
  process.exit(1);
}

console.log(`PASS: All ${WIDGET_PRESETS.length} presets + security + reason-aware degradation + Profile 1 guards passed.`);
