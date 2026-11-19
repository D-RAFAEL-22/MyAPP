import { useState } from 'react';
import { BookOpen, Check, Code2, Copy, FileJson, Send } from 'lucide-react';
import { promptGuide, widgetSpecSchema } from '../tw/schema.ts';
import type { CompileResult, SendWidgetParams } from '../tw/types.ts';

interface OutputPanelProps {
  compiled: CompileResult | null;
  sendWidgetParams: SendWidgetParams | null;
}

type OutputTab = 'html' | 'botapi' | 'schema' | 'prompt';

export function OutputPanel({ compiled, sendWidgetParams }: OutputPanelProps) {
  const [tab, setTab] = useState<OutputTab>('html');
  const [copied, setCopied] = useState(false);

  const schemaText = JSON.stringify(widgetSpecSchema, null, 2);
  const guideText = promptGuide();

  const activeContent =
    tab === 'html'
      ? (compiled?.html ?? '')
      : tab === 'botapi'
        ? (sendWidgetParams ? JSON.stringify(sendWidgetParams, null, 2) : '')
        : tab === 'schema'
          ? schemaText
          : guideText;

  const handleCopy = async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked in restricted iframes
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: 'html', label: 'Compiled HTML', icon: Code2 },
              { id: 'botapi', label: 'Bot API 10.4', icon: Send },
              { id: 'schema', label: 'JSON Schema', icon: FileJson },
              { id: 'prompt', label: 'promptGuide()', icon: BookOpen },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tab === id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!activeContent}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="p-3">
        {activeContent ? (
          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-slate-100">
            {activeContent}
          </pre>
        ) : (
          <div className="py-10 text-center text-xs text-slate-400">
            Compile a valid widget spec to inspect output.
          </div>
        )}
      </div>
    </div>
  );
}
