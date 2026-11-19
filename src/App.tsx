import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Cpu,
  Settings2,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { BudgetPanel } from './components/BudgetPanel.tsx';
import { OutputPanel } from './components/OutputPanel.tsx';
import { TelegramSandbox } from './components/TelegramSandbox.tsx';
import { HARD_BUDGETS } from './tw/limits.ts';
import { WIDGET_PRESETS } from './tw/presets.ts';
import type {
  Budgets,
  CompileResult,
  SendWidgetParams,
  WidgetError,
} from './tw/types.ts';

interface ApiCompileResponse {
  ok: boolean;
  value?: CompileResult;
  sendWidgetParams?: SendWidgetParams;
  error?: WidgetError;
}

export default function App() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(WIDGET_PRESETS[0].id);
  const [specText, setSpecText] = useState<string>(() => JSON.stringify(WIDGET_PRESETS[0].spec, null, 2));
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);

  // Compiler options
  const [showOptions, setShowOptions] = useState(false);
  const [allowedOriginsText, setAllowedOriginsText] = useState('https://acme.sayf.example');
  const [botUsername, setBotUsername] = useState('sayf_demo_bot');
  const [maxDeflated, setMaxDeflated] = useState<number>(HARD_BUDGETS.deflated);
  const [maxHeight, setMaxHeight] = useState<number>(HARD_BUDGETS.height320);

  // Compilation state
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [sendWidgetParams, setSendWidgetParams] = useState<SendWidgetParams | null>(null);
  const [compileError, setCompileError] = useState<WidgetError | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const effectiveBudgets: Budgets = {
    ...HARD_BUDGETS,
    deflated: Math.min(HARD_BUDGETS.deflated, Math.max(256, maxDeflated || HARD_BUDGETS.deflated)),
    height320: Math.min(HARD_BUDGETS.height320, Math.max(120, maxHeight || HARD_BUDGETS.height320)),
  };

  const runCompile = useCallback(
    async (rawText: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
        setJsonSyntaxError(null);
      } catch (e) {
        setJsonSyntaxError(e instanceof Error ? e.message : 'Invalid JSON syntax');
        setCompiled(null);
        setSendWidgetParams(null);
        setCompileError(null);
        return;
      }

      setCompiling(true);
      try {
        const origins = allowedOriginsText
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const res = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spec: parsed,
            allowedOrigins: origins,
            botUsername: botUsername.trim() || undefined,
            limits: {
              deflated: effectiveBudgets.deflated,
              height320: effectiveBudgets.height320,
            },
          }),
        });

        const data = (await res.json()) as ApiCompileResponse;
        if (data.ok && data.value) {
          setCompiled(data.value);
          setSendWidgetParams(data.sendWidgetParams ?? null);
          setCompileError(null);
        } else {
          setCompiled(null);
          setSendWidgetParams(null);
          setCompileError(data.error ?? null);
        }
      } catch (e) {
        setCompileError({
          code: 'invalid_spec',
          issues: [{ path: 'network', message: e instanceof Error ? e.message : 'Compile request failed' }],
        });
      } finally {
        setCompiling(false);
      }
    },
    [allowedOriginsText, botUsername, effectiveBudgets.deflated, effectiveBudgets.height320],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void runCompile(specText);
    }, 180);
    return () => clearTimeout(timer);
  }, [specText, runCompile]);

  const handleSelectPreset = (presetId: string) => {
    const found = WIDGET_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setSpecText(JSON.stringify(found.spec, null, 2));
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(specText);
      setSpecText(JSON.stringify(parsed, null, 2));
      setJsonSyntaxError(null);
    } catch (e) {
      setJsonSyntaxError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const activePreset = WIDGET_PRESETS.find((p) => p.id === selectedPresetId);
  const errorSizes = compileError?.code === 'too_large' ? compileError.sizes : null;
  const errorDegraded = compileError?.code === 'too_large' ? compileError.degraded : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">
                  TW — Telegram Widget Compiler
                </h1>
                <span className="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-sky-700">
                  Bot API 10.4 · Profile 1
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Deterministic JSON → HTML compiler with Node zlib-9 metering, degradation §4.7, and 320px QuickJS-style sandbox
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOptions((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showOptions
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Compile Options
            </button>
          </div>
        </div>

        {/* Preset Bar */}
        <div className="border-t border-slate-100 bg-slate-50/80">
          <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-2">
            <span className="shrink-0 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Scenarios:
            </span>
            {WIDGET_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedPresetId === preset.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Compile Options */}
        {showOptions && (
          <div className="border-t border-slate-200 bg-white px-4 py-3">
            <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  allowedOrigins (https only)
                </label>
                <input
                  type="text"
                  value={allowedOriginsText}
                  onChange={(e) => setAllowedOriginsText(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  botUsername (for t.me links)
                </label>
                <input
                  type="text"
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  zlib-9 Budget Ceiling (≤ 3,800 B)
                </label>
                <input
                  type="number"
                  min={256}
                  max={3800}
                  value={maxDeflated}
                  onChange={(e) => setMaxDeflated(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Height Ceiling @ 320px (≤ 560 px)
                </label>
                <input
                  type="number"
                  min={160}
                  max={560}
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-800"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main 3-Column Studio Grid */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 p-4 lg:grid-cols-12">
        {/* Left: JSON Spec Editor + Validation Diagnostics */}
        <section className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-semibold text-slate-900">WidgetSpec JSON (v1)</h2>
              </div>
              <div className="flex items-center gap-2">
                {compiling ? (
                  <span className="text-[11px] text-slate-400">Compiling…</span>
                ) : compiled ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Wand2 className="h-3 w-3" /> Format
                </button>
              </div>
            </div>

            {activePreset && (
              <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-600">
                {activePreset.description}
              </div>
            )}

            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              spellCheck={false}
              className="min-h-[420px] flex-1 resize-y rounded-b-xl bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none"
            />
          </div>

          {/* Diagnostics Box */}
          {(jsonSyntaxError || compileError) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-900">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                {jsonSyntaxError ? 'JSON Syntax Error' : `Compiler Error: ${compileError?.code}`}
              </div>

              {jsonSyntaxError && (
                <div className="font-mono text-xs text-rose-800">{jsonSyntaxError}</div>
              )}

              {compileError?.code === 'invalid_spec' && (
                <ul className="space-y-1 font-mono text-xs text-rose-800">
                  {compileError.issues.map((iss, idx) => (
                    <li key={`${iss.path}-${idx}`}>
                      <span className="font-semibold">{iss.path}</span>: {iss.message}
                    </li>
                  ))}
                </ul>
              )}

              {compileError?.code === 'link_not_allowed' && (
                <div className="font-mono text-xs text-rose-800">
                  <span className="font-semibold">{compileError.path}</span>: URL &quot;{compileError.url}&quot; is not https or not in allowedOrigins.
                </div>
              )}

              {compileError?.code === 'action_too_long' && (
                <div className="font-mono text-xs text-rose-800">
                  <span className="font-semibold">{compileError.path}</span>: payload is {compileError.bytes} UTF-8 bytes (Telegram limit: 64 bytes).
                </div>
              )}

              {compileError?.code === 'chat_data_too_large' && (
                <div className="font-mono text-xs text-rose-800">
                  Serialized state is {compileError.bytes} UTF-8 bytes (Telegram limit: 1,024 bytes).
                </div>
              )}

              {compileError?.code === 'too_large' && (
                <div className="space-y-1 text-xs text-rose-800">
                  <div>
                    Exceeded <span className="font-mono font-semibold">{compileError.reason}</span> budget even after applying {compileError.degraded.length} degradation step(s).
                  </div>
                  <div className="font-mono">
                    zlib-9: {compileError.sizes.deflatedBytes} B · UTF-8: {compileError.sizes.utf8Bytes} B · Forecast height: {compileError.sizes.predictedHeight320} px
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security & Guarantees Footer Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 shadow-xs">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Profile 1 &amp; Security Invariants Enforced
            </div>
            <ul className="grid grid-cols-1 gap-1 text-[11.5px] sm:grid-cols-2">
              <li>• Zero raw HTML / zero <code className="font-mono">innerHTML</code></li>
              <li>• Only <code className="font-mono">--tg-theme-*</code> CSS variables</li>
              <li>• U+0000 &amp; C0/C1 control char stripping</li>
              <li>• Strict HTTPS <code className="font-mono">allowedOrigins</code></li>
              <li>• Deterministic CSS &amp; runtime tree-shaking</li>
              <li>• Action buttons never dropped on degrade</li>
            </ul>
          </div>
        </section>

        {/* Middle: Live Telegram 320px Sandbox */}
        <section className="lg:col-span-4">
          <TelegramSandbox compiled={compiled} onMeasuredHeight={setMeasuredHeight} />
        </section>

        {/* Right: Budgets + Compiled Output / Schema / Prompt Guide */}
        <section className="flex flex-col gap-4 lg:col-span-3">
          <BudgetPanel
            sizes={compiled?.sizes ?? errorSizes}
            budgets={effectiveBudgets}
            measuredHeight={measuredHeight}
            degraded={compiled?.degraded ?? errorDegraded}
            usedCssKeys={compiled?.usedCssKeys ?? []}
            usedRuntimeKeys={compiled?.usedRuntimeKeys ?? []}
            hasError={Boolean(jsonSyntaxError || compileError)}
            compiled={compiled}
          />
          <OutputPanel compiled={compiled} sendWidgetParams={sendWidgetParams} />
        </section>
      </main>
    </div>
  );
}
