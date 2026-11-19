import { AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import type { Budgets, CompileResult, CompileSizes } from '../tw/types.ts';

interface BudgetPanelProps {
  sizes: CompileSizes | null;
  budgets: Budgets;
  measuredHeight: number | null;
  degraded: string[];
  usedCssKeys: string[];
  usedRuntimeKeys: string[];
  hasError: boolean;
  compiled: CompileResult | null;
}

interface MeterRowProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  sublabel?: string;
}

function MeterRow({ label, value, max, unit, sublabel }: MeterRowProps) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const over = value > max;
  const warn = !over && pct >= 82;

  const barColor = over
    ? 'bg-rose-600'
    : warn
      ? 'bg-amber-500'
      : 'bg-sky-600';

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-mono ${over ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>
          {value.toLocaleString()} / {max.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full transition-all duration-200 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {sublabel && <div className="text-[11px] text-slate-500">{sublabel}</div>}
    </div>
  );
}

export function BudgetPanel({
  sizes,
  budgets,
  measuredHeight,
  degraded,
  usedCssKeys,
  usedRuntimeKeys,
  hasError,
}: BudgetPanelProps) {
  const heightValue = measuredHeight ?? sizes?.predictedHeight320 ?? 0;
  const heightOver = heightValue > budgets.height320;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-900">Profile 1 Budgets</h2>
        </div>
        {sizes && !hasError ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
              heightOver
                ? 'bg-rose-50 text-rose-700'
                : degraded.length > 0
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {heightOver ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" /> Height &gt; {budgets.height320}px
              </>
            ) : degraded.length > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" /> Degraded ({degraded.length})
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Within Budget
              </>
            )}
          </span>
        ) : null}
      </div>

      {sizes ? (
        <div className="space-y-3">
          <MeterRow
            label="zlib-9 Compressed HTML"
            value={sizes.deflatedBytes}
            max={budgets.deflated}
            unit="B"
            sublabel="Telegram hard cap is 4,096 B; TW enforces 3,800 B safety ceiling"
          />
          <MeterRow
            label="Raw UTF-8 HTML"
            value={sizes.utf8Bytes}
            max={budgets.htmlBytes}
            unit="B"
          />
          <MeterRow
            label="chat_data JSON"
            value={sizes.chatDataBytes}
            max={budgets.chatDataBytes}
            unit="B"
          />
          <MeterRow
            label="Fallback Caption"
            value={sizes.captionChars}
            max={budgets.captionChars}
            unit="chars"
          />
          <MeterRow
            label="Height @ 320px"
            value={heightValue}
            max={budgets.height320}
            unit="px"
            sublabel={
              measuredHeight !== null
                ? `Measured in sandbox: ${measuredHeight}px · Compiler forecast: ${sizes.predictedHeight320}px`
                : `Compiler forecast: ${sizes.predictedHeight320}px`
            }
          />

          {degraded.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-amber-900 uppercase">
                Applied Degradation Steps (§4.7)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {degraded.map((step) => (
                  <span
                    key={step}
                    className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
            <div>
              <div className="mb-1 font-medium text-slate-500">Emitted CSS ({usedCssKeys.length})</div>
              <div className="flex flex-wrap gap-1">
                {usedCssKeys.map((k) => (
                  <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                    {k}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 font-medium text-slate-500">Runtime Chunks ({usedRuntimeKeys.length})</div>
              <div className="flex flex-wrap gap-1">
                {usedRuntimeKeys.length > 0 ? (
                  usedRuntimeKeys.map((k) => (
                    <span key={k} className="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-sky-800">
                      {k}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">none (static HTML)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-500">
          Fix spec validation errors to measure compiled budgets.
        </div>
      )}
    </div>
  );
}
