import { escScriptJson } from '../escape.ts';
import type { ResolvedServiceWords, StatusBadgeOption } from '../types.ts';

export interface RuntimeBuildContext {
  usedChunks: Set<string>;
  badgeMaps: Record<string, Record<string, StatusBadgeOption>>;
  words: ResolvedServiceWords;
}

const RUNTIME_ORDER = ['base', 'bind', 'req', 'link', 'page', 'tabs', 'more', 'acc'] as const;

/**
 * Builds minimal ES2023 inline script for Telegram Widget Profile 1.
 * Strict rules:
 * - Zero innerHTML usage anywhere (only textContent & whitelisted attributes)
 * - Synchronous TelegramWidget.request / openLink / openTelegramLink on click
 * - Graceful no-op when window.TelegramWidget is undefined
 * - Monotonic state revision guard `r`
 */
export function assembleRuntime(ctx: RuntimeBuildContext): { js: string; orderedKeys: string[] } {
  const hasAny = Array.from(ctx.usedChunks).some((k) => k !== 'base');
  if (!hasAny) {
    return { js: '', orderedKeys: [] };
  }
  ctx.usedChunks.add('base');

  const orderedKeys: string[] = [];
  const parts: string[] = [];

  for (const key of RUNTIME_ORDER) {
    if (!ctx.usedChunks.has(key)) continue;
    orderedKeys.push(key);

    if (key === 'base') {
      parts.push(
        `const T=window.TelegramWidget,D=document,Q=(s,r=D)=>r.querySelector(s),QA=(s,r=D)=>r.querySelectorAll(s);`,
      );
    } else if (key === 'bind') {
      const bmJson = escScriptJson(ctx.badgeMaps);
      parts.push(
        `const BM=${bmJson};let LR=-1;function AP(raw){if(!raw)return;let s;try{s=JSON.parse(raw)}catch{return}if(!s||typeof s.r!=="number"||s.r<=LR)return;LR=s.r;QA("[data-b]").forEach(el=>{const k=el.dataset.b;if(!(k in s))return;const v=s[k];if(el.dataset.bm){const m=BM[el.dataset.bm],o=m&&m[String(v)];if(o){el.textContent=o.label;el.dataset.t=o.tone}}else if(el.dataset.pr==="1"){const n=Math.max(0,Math.min(100,Number(v)||0));const f=Q(".prf",el),p=Q(".prp",el);if(f)f.style.width=n+"%";if(p)p.textContent=n+"%"}else{el.textContent=String(v)}});if(Array.isArray(s.act)){const set=new Set(s.act);QA("[data-ak]").forEach(b=>{b.hidden=!set.has(b.dataset.ak)})}}if(T&&T.chatData)AP(T.chatData);if(T&&T.onEvent)T.onEvent("chatDataChanged",()=>{if(T.chatData)AP(T.chatData)});`,
      );
    } else if (key === 'req') {
      const wJson = escScriptJson({
        p: ctx.words.pending,
        f: ctx.words.failed,
        b: ctx.words.busy,
        n: ctx.words.notAllowed,
      });
      parts.push(
        `const W=${wJson};QA("[data-k]").forEach(btn=>{btn.addEventListener("click",()=>{if(!T||typeof T.request!=="function"||btn.disabled)return;const orig=btn.textContent,st=Q(".st");btn.disabled=true;btn.textContent=W.p;if(st)st.textContent="";let p;try{p=T.request(btn.dataset.k)}catch(e){btn.disabled=false;btn.textContent=orig;if(st)st.textContent=W.f;return}Promise.resolve(p).then(res=>{btn.disabled=false;btn.textContent=orig;if(st&&res){try{const j=typeof res==="string"?JSON.parse(res):res;st.textContent=typeof j==="string"?j:(j.result||j.message||"")}catch{st.textContent=String(res)}}}).catch(e=>{btn.disabled=false;btn.textContent=orig;const c=e&&e.code;if(st)st.textContent=c==="BUSY"||c==="RATE_LIMITED"?W.b:c==="NOT_ALLOWED"?W.n:W.f})})});`,
      );
    } else if (key === 'link') {
      parts.push(
        `QA("[data-u]").forEach(btn=>{btn.addEventListener("click",()=>{if(!T)return;const u=btn.dataset.u;if(!u)return;if(u.startsWith("https://t.me/")&&typeof T.openTelegramLink==="function")T.openTelegramLink(u);else if(typeof T.openLink==="function")T.openLink(u)})});`,
      );
    } else if (key === 'page') {
      parts.push(
        `QA("[data-ls]").forEach(box=>{const ps=Number(box.dataset.ps)||5,its=[...box.children].filter(e=>e.dataset.li==="1"),ofS=box.dataset.of||"/",ind=Q(".pgi",box),pv=Q("[data-pg=p]",box),nx=Q("[data-pg=n]",box),pages=Math.max(1,Math.ceil(its.length/ps));let cur=0;function go(n){cur=Math.max(0,Math.min(pages-1,n));its.forEach((el,i)=>{el.hidden=i<cur*ps||i>=(cur+1)*ps});if(ind)ind.textContent=(cur+1)+ofS+pages;if(pv)pv.disabled=cur===0;if(nx)nx.disabled=cur===pages-1}if(pv)pv.addEventListener("click",()=>go(cur-1));if(nx)nx.addEventListener("click",()=>go(cur+1));go(0)});`,
      );
    } else if (key === 'tabs') {
      parts.push(
        `QA("[data-tb]").forEach(box=>{const btns=[...QA(":scope>.tbb>.tbt",box)],pans=[...QA(":scope>.tbp",box)];btns.forEach((b,i)=>{b.addEventListener("click",()=>{btns.forEach((x,j)=>x.setAttribute("aria-selected",j===i?"true":"false"));pans.forEach((p,j)=>{p.hidden=j!==i})})})});`,
      );
    } else if (key === 'more') {
      parts.push(
        `QA("[data-tg]").forEach(btn=>{btn.addEventListener("click",()=>{const el=D.getElementById(btn.dataset.tg);if(!el)return;const open=el.hidden;el.hidden=!open;const l1=btn.dataset.l1,l2=btn.dataset.l2;if(l1&&l2)btn.textContent=open?l2:l1})});`,
      );
    } else if (key === 'acc') {
      parts.push(
        `QA("[data-ac]").forEach(g=>{const ds=[...QA(":scope>.ad",g)];ds.forEach(d=>{d.addEventListener("toggle",()=>{if(d.open)ds.forEach(o=>{if(o!==d)o.open=false})})})});`,
      );
    }
  }

  const js = `(()=>{${parts.join('')}})();`;
  return { js, orderedKeys };
}
