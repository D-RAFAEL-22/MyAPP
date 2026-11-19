import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ExternalLink,
  Moon,
  RefreshCw,
  Send,
  Smartphone,
  Sun,
  Terminal,
} from 'lucide-react';
import type { CompileResult } from '../tw/types.ts';

interface TelegramSandboxProps {
  compiled: CompileResult | null;
  onMeasuredHeight: (height: number | null) => void;
}

interface SandboxLogEntry {
  id: number;
  time: string;
  kind: 'request' | 'link' | 'chatData' | 'system';
  detail: string;
}

interface PendingQuery {
  reqId: number;
  payload: string;
}

const LIGHT_THEME: Record<string, string> = {
  '--tg-theme-bg-color': '#ffffff',
  '--tg-theme-text-color': '#18222d',
  '--tg-theme-hint-color': '#707579',
  '--tg-theme-link-color': '#2481cc',
  '--tg-theme-button-color': '#2481cc',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#f1f3f5',
  '--tg-theme-accent-text-color': '#2481cc',
  '--tg-theme-subtitle-text-color': '#b45309',
  '--tg-theme-destructive-text-color': '#dc2626',
  '--tg-theme-section-separator-color': '#e2e8f0',
};

const DARK_THEME: Record<string, string> = {
  '--tg-theme-bg-color': '#212d3b',
  '--tg-theme-text-color': '#f5f5f5',
  '--tg-theme-hint-color': '#8b9bab',
  '--tg-theme-link-color': '#6ab3f3',
  '--tg-theme-button-color': '#5288c1',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#17212b',
  '--tg-theme-accent-text-color': '#6ab3f3',
  '--tg-theme-subtitle-text-color': '#fbbf24',
  '--tg-theme-destructive-text-color': '#f87171',
  '--tg-theme-section-separator-color': '#2b3949',
};

function buildThemeCssVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function buildSandboxSrcDoc(
  widgetHtml: string,
  initialChatData: string,
  colorScheme: 'light' | 'dark',
): string {
  const themeVars = colorScheme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const safeChatData = JSON.stringify(initialChatData).replace(/</g, '\\u003c');
  const safeLight = JSON.stringify(LIGHT_THEME).replace(/</g, '\\u003c');
  const safeDark = JSON.stringify(DARK_THEME).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style id="tg-host-theme">:root{${buildThemeCssVars(themeVars)}}html,body{width:320px;overflow:hidden;margin:0;}</style>
<script>
(function(){
  const LIGHT=${safeLight},DARK=${safeDark};
  const listeners=new Map();
  let nextReq=1;
  const pending=new Map();
  function emit(type){
    const set=listeners.get(type);
    if(set) set.forEach(fn=>{try{fn()}catch(e){console.error(e)}});
  }
  function applyTheme(scheme){
    const vars=scheme==="dark"?DARK:LIGHT;
    const root=document.documentElement;
    Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
    api.colorScheme=scheme;
    emit("themeChanged");
  }
  const api={
    profile:1,
    isProfileAtLeast:(n)=>n<=1,
    colorScheme:${JSON.stringify(colorScheme)},
    chatData:${safeChatData},
    isActive:true,
    ready:()=>{},
    setResizeAnchor:()=>{},
    onEvent:(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},
    offEvent:(type,fn)=>{const s=listeners.get(type);if(s)s.delete(fn)},
    request:(data)=>{
      const id=nextReq++;
      return new Promise((resolve,reject)=>{
        pending.set(id,{resolve,reject});
        window.parent.postMessage({__tw:true,type:"request",reqId:id,data:String(data||"")},"*");
      });
    },
    openLink:(url)=>{
      window.parent.postMessage({__tw:true,type:"openLink",url:String(url||"")},"*");
    },
    openTelegramLink:(url)=>{
      window.parent.postMessage({__tw:true,type:"openTelegramLink",url:String(url||"")},"*");
    },
    copyText:(text)=>{
      window.parent.postMessage({__tw:true,type:"copyText",text:String(text||"")},"*");
    },
    HapticFeedback:{
      impactOccurred:()=>{},
      notificationOccurred:()=>{},
      selectionChanged:()=>{}
    }
  };
  window.TelegramWidget=api;
  window.addEventListener("message",(ev)=>{
    const msg=ev.data;
    if(!msg||!msg.__twHost)return;
    if(msg.type==="theme"){
      applyTheme(msg.scheme);
    }else if(msg.type==="setChatData"){
      api.chatData=msg.chatData;
      emit("chatDataChanged");
    }else if(msg.type==="answerQuery"){
      const p=pending.get(msg.reqId);
      if(!p)return;
      pending.delete(msg.reqId);
      if(msg.errorCode){
        const err=new Error(msg.errorCode);
        err.code=msg.errorCode;
        p.reject(err);
      }else{
        p.resolve(msg.data);
      }
    }
  });
  function postHeight(){
    const h=Math.ceil(document.documentElement.scrollHeight||document.body.scrollHeight||0);
    window.parent.postMessage({__tw:true,type:"height",height:h},"*");
  }
  window.addEventListener("load",()=>{
    postHeight();
    if(typeof ResizeObserver!=="undefined"){
      const ro=new ResizeObserver(postHeight);
      ro.observe(document.body);
    }
    const mo=new MutationObserver(postHeight);
    mo.observe(document.body,{subtree:true,childList:true,attributes:true});
  });
})();
</script>
</head>
<body>
${widgetHtml}
</body>
</html>`;
}

export function TelegramSandbox({ compiled, onMeasuredHeight }: TelegramSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [iframeHeight, setIframeHeight] = useState<number>(240);
  const [autoReply, setAutoReply] = useState<boolean>(true);
  const [pendingQuery, setPendingQuery] = useState<PendingQuery | null>(null);
  const [customReply, setCustomReply] = useState<string>('Готово ✓');
  const [logs, setLogs] = useState<SandboxLogEntry[]>([]);
  const [chatDataDraft, setChatDataDraft] = useState<string>('');
  const [chatDataError, setChatDataError] = useState<string | null>(null);
  const logIdRef = useRef(1);

  useEffect(() => {
    if (compiled) {
      setChatDataDraft(compiled.chatData);
      setChatDataError(null);
      setPendingQuery(null);
    } else {
      onMeasuredHeight(null);
    }
  }, [compiled, onMeasuredHeight]);

  const appendLog = (kind: SandboxLogEntry['kind'], detail: string) => {
    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [{ id: logIdRef.current++, time: now, kind, detail }, ...prev].slice(0, 18));
  };

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data as {
        __tw?: boolean;
        type?: string;
        height?: number;
        reqId?: number;
        data?: string;
        url?: string;
        text?: string;
      };
      if (!msg || !msg.__tw) return;

      if (msg.type === 'height' && typeof msg.height === 'number') {
        setIframeHeight(Math.max(80, msg.height));
        onMeasuredHeight(msg.height);
      } else if (msg.type === 'request' && typeof msg.reqId === 'number') {
        const payload = msg.data ?? '';
        appendLog('request', `widget_query → "${payload}"`);
        if (autoReply) {
          setTimeout(() => {
            iframeRef.current?.contentWindow?.postMessage(
              {
                __twHost: true,
                type: 'answerQuery',
                reqId: msg.reqId,
                data: JSON.stringify({ result: `OK (${payload})` }),
              },
              '*',
            );
            appendLog('system', `answerWidgetQuery ← {"result":"OK (${payload})"}`);
          }, 350);
        } else {
          setPendingQuery({ reqId: msg.reqId, payload });
        }
      } else if (msg.type === 'openLink') {
        appendLog('link', `openLink("${msg.url ?? ''}")`);
      } else if (msg.type === 'openTelegramLink') {
        appendLog('link', `openTelegramLink("${msg.url ?? ''}")`);
      } else if (msg.type === 'copyText') {
        appendLog('system', `copyText("${msg.text ?? ''}")`);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [autoReply, onMeasuredHeight]);

  const toggleTheme = () => {
    const next = scheme === 'light' ? 'dark' : 'light';
    setScheme(next);
    iframeRef.current?.contentWindow?.postMessage({ __twHost: true, type: 'theme', scheme: next }, '*');
  };

  const resolvePendingQuery = (errorCode?: string) => {
    if (!pendingQuery) return;
    if (errorCode) {
      iframeRef.current?.contentWindow?.postMessage(
        { __twHost: true, type: 'answerQuery', reqId: pendingQuery.reqId, errorCode },
        '*',
      );
      appendLog('system', `answerWidgetQuery ← ERROR ${errorCode}`);
    } else {
      const payload = JSON.stringify({ result: customReply });
      iframeRef.current?.contentWindow?.postMessage(
        { __twHost: true, type: 'answerQuery', reqId: pendingQuery.reqId, data: payload },
        '*',
      );
      appendLog('system', `answerWidgetQuery ← ${payload}`);
    }
    setPendingQuery(null);
  };

  const pushChatData = (bumpRevision: boolean) => {
    try {
      const parsed = JSON.parse(chatDataDraft) as Record<string, unknown>;
      if (bumpRevision && typeof parsed.r === 'number') {
        parsed.r = parsed.r + 1;
      }
      const serialized = JSON.stringify(parsed);
      const byteLen = new TextEncoder().encode(serialized).length;
      if (byteLen > 1024) {
        setChatDataError(`chat_data is ${byteLen} bytes (max 1,024)`);
        return;
      }
      setChatDataError(null);
      setChatDataDraft(serialized);
      iframeRef.current?.contentWindow?.postMessage(
        { __twHost: true, type: 'setChatData', chatData: serialized },
        '*',
      );
      appendLog('chatData', `editMessageWidgetData(r=${String(parsed.r)}) → ${serialized}`);
    } catch {
      setChatDataError('Invalid JSON in chat_data editor');
    }
  };

  const srcDoc = useMemo(() => {
    if (!compiled) return '';
    return buildSandboxSrcDoc(compiled.html, compiled.chatData, scheme);
  }, [compiled]); // Keep iframe stable across theme toggle (theme updates via postMessage)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-900">Telegram Profile 1 Preview (320px)</h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={autoReply}
                onChange={(e) => setAutoReply(e.target.checked)}
                className="rounded border-slate-300 text-sky-600"
              />
              Auto-answer queries
            </label>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {scheme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {scheme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

        {/* Telegram chat wallpaper frame */}
        <div
          className={`flex flex-col items-center rounded-xl border p-4 transition-colors ${
            scheme === 'dark'
              ? 'border-slate-700 bg-[#0e1621]'
              : 'border-slate-200 bg-[#dbe7f0]'
          }`}
        >
          {compiled ? (
            <div className="w-[320px] max-w-full">
              <div
                className={`overflow-hidden rounded-2xl shadow-sm ${
                  scheme === 'dark' ? 'bg-[#212d3b]' : 'bg-white'
                }`}
              >
                <iframe
                  ref={iframeRef}
                  title="Telegram Widget Preview"
                  sandbox="allow-scripts"
                  srcDoc={srcDoc}
                  style={{ width: '320px', height: `${iframeHeight}px`, border: 0, display: 'block' }}
                />
                <div
                  className={`flex items-center justify-between border-t px-3.5 py-1.5 text-[11px] ${
                    scheme === 'dark'
                      ? 'border-[#2b3949] text-[#8b9bab]'
                      : 'border-slate-100 text-slate-500'
                  }`}
                >
                  <span>Protected · Private chat</span>
                  <span className="font-mono">320 × {iframeHeight}px</span>
                </div>
              </div>
              <div
                className={`mt-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  scheme === 'dark'
                    ? 'bg-[#182533] text-slate-300'
                    : 'bg-white/85 text-slate-700'
                }`}
              >
                <div className="mb-0.5 text-[10px] font-semibold tracking-wider uppercase opacity-65">
                  Fallback Caption (older clients)
                </div>
                <div className="whitespace-pre-line">{compiled.caption}</div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-500">
              No valid widget compiled yet.
            </div>
          )}
        </div>

        {/* Manual pending widget_query responder */}
        {pendingQuery && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-900">
                Incoming <code className="font-mono">widget_query</code>: &quot;{pendingQuery.payload}&quot;
              </span>
              <span className="text-[11px] text-sky-700">15s Bot API window</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <input
                type="text"
                value={customReply}
                onChange={(e) => setCustomReply(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-sky-200 bg-white px-2 py-1 text-xs text-slate-800"
                placeholder="Reply message..."
              />
              <button
                type="button"
                onClick={() => resolvePendingQuery()}
                className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
              >
                <Check className="h-3.5 w-3.5" /> Answer
              </button>
              <button
                type="button"
                onClick={() => resolvePendingQuery('RATE_LIMITED')}
                className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                RATE_LIMITED
              </button>
              <button
                type="button"
                onClick={() => resolvePendingQuery('TIMEOUT')}
                className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
              >
                TIMEOUT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live editMessageWidgetData simulator */}
      {compiled && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-sky-600" />
              <h3 className="text-xs font-semibold text-slate-900">
                Live <code className="font-mono">editMessageWidgetData</code> (chat_data)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => pushChatData(true)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Send className="h-3 w-3" /> Push (r+1)
            </button>
          </div>
          <p className="mb-2 text-[11px] text-slate-500">
            Edit state fields (e.g. <code className="font-mono">status</code>, <code className="font-mono">progress</code>, <code className="font-mono">act</code>) and push to trigger <code className="font-mono">chatDataChanged</code> inside the live widget.
          </p>
          <textarea
            value={chatDataDraft}
            onChange={(e) => setChatDataDraft(e.target.value)}
            rows={2}
            spellCheck={false}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-none"
          />
          {chatDataError && <div className="mt-1 text-xs text-rose-600">{chatDataError}</div>}
        </div>
      )}

      {/* Bridge Event Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-900">TelegramWidget Bridge Events</h3>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <div className="py-3 text-xs text-slate-400">
            Tap request buttons, links, or push chat_data to observe bridge calls.
          </div>
        ) : (
          <div className="max-h-40 space-y-1.5 overflow-y-auto font-mono text-[11px]">
            {logs.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 rounded bg-slate-50 px-2 py-1">
                <span className="shrink-0 text-slate-400">{entry.time}</span>
                {entry.kind === 'link' && <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-sky-600" />}
                <span className="break-all text-slate-700">{entry.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
