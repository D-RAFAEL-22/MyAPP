# Agent Onboarding Map: TW — Telegram Widget Compiler

Этот документ — быстрая карта репозитория для coding-агента. Цель: за 2 минуты понять, что такое TW, как устроен код, где лежат первоисточники и в каком порядке его изучать и проверять.

---

## 1. Суть проекта в одном абзаце

**TW** — zero-dependency TypeScript-компилятор `WidgetSpec (JSON v1) → HTML` для **Telegram Bot API 10.4 Widgets (Profile 1 / QuickJS без сети)**, созданный для интеграции в SAYF, плюс локальная веб-студия (`server.ts` + React) для интерактивной отладки и замера `zlib` уровня 9.

**Жёсткие инварианты ядра (`src/tw/`):**
- Детерминизм: одинаковый вход → байт-в-байт одинаковые `html`, `chatData`, `caption`.
- Zero external dependencies в `src/tw/` (кроме отдельного адаптера `src/tw/measure-node.ts` с `node:zlib`). Никаких `Zod`, `React`, `fetch`, `Date`, `Math.random`, `process` в ядре.
- Относительные импорты в `src/tw/` строго с расширением `.ts` (совместимость с Deno 2, Node 22 и Vite).
- `compileWidget()` **никогда не бросает исключений** — всегда возвращает `Result<CompileResult, WidgetError>`.
- Жёсткие бюджеты: UTF-8 HTML ≤ `32 768` Б, **zlib-9 ≤ `3 800` Б** (запас от серверных 4 096 Б), `chat_data` ≤ `1 024` Б, `caption` ≤ `1 024` знаков, высота @ 320 px ≤ `560` px.
- Безопасность и Profile 1: только `var(--tg-theme-*)`, нет `innerHTML`, `U+0000`, `vh`, `opacity`, `filter`, `text-shadow`, `touch-action`, `<input>/<form>`, внешних URL. Кнопки действий не выпадают при деградации.

---

## 2. Порядок изучения проекта агентом

1. **Первоисточники и контракт** (лежат внутри `tw-handoff.zip`):
   - `CLAUDE.md` и `docs/PLAN.md` — архитектура, фазы, решения и риски;
   - `docs/input/spec-TW.md` — главный контракт (§4–§10);
   - `docs/telegram/bot-api-10.4-widgets.md` — точные типы и методы Bot API 10.4;
   - `docs/telegram/widget-author-guide.md` и `vendor/widget-sandbox/docs/` (`profile-v1.md`, `sdk-v1.md`, `widget-runtime-profile.md`) — правила Profile 1 и QuickJS SDK.
2. **Контракт и публичный API компилятора**: `src/tw/index.ts` → `src/tw/types.ts` → `src/tw/limits.ts` → `src/tw/errors.ts`.
3. **Конвейер компиляции**: `src/tw/compile.ts` → `src/tw/validate.ts` → `src/tw/degrade.ts` → `src/tw/render/html.ts` → `src/tw/render/css.ts` → `src/tw/render/runtime.ts`.
4. **Проверки и профилирование**: `scripts/check-profile1.ts` и `scripts/weigh.ts`.
5. **Студия и сервер (dev-оболочка, не входит в библиотечный пакет SAYF)**: `server.ts` → `src/App.tsx` → `src/components/TelegramSandbox.tsx`.

---

## 3. Полная карта файлов репозитория

### Корень проекта и конфигурация
| Путь | Назначение |
|---|---|
| `tw-handoff.zip` | Оригинальный архив первоисточников (34 файла): `CLAUDE.md`, `HANDOFF.md`, `docs/PLAN.md`, `docs/input/spec-TW.md`, доки Bot API 10.4, `vendor/widget-sandbox/docs/*`, скрипты `setup-vendor.sh`, `check-widget.sh`. **Не удалять.** |
| `package.json` | Скрипты (`dev`, `build`, `start`, `lint`, `check:profile1`, `weigh`) и зависимости. |
| `tsconfig.json` | Строгий TypeScript (`strict: true`, `allowImportingTsExtensions: true`), покрывает `src`, `scripts`, `server.ts`, `vite.config.ts`. |
| `vite.config.ts` | Конфиг Vite + React + Tailwind v4 (`host: 0.0.0.0`, `port: 3000`). |
| `index.html` | HTML-точка входа веб-студии. |
| `metadata.json` | Метаданные приложения для AI Studio. |
| `.env.example` | Пример переменных окружения (`PORT=3000`). |
| `server.ts` | Express-сервер (порт 3000, Vite middleware в dev, `dist/` в prod). Даёт API: `POST /api/compile` (с реальным Node `zlib-9`), `POST /api/chat-data`, `GET /api/schema`, `GET /api/prompt-guide`, `GET /api/health`. |

### Документация передачи (`docs/`)
| Путь | Назначение |
|---|---|
| `docs/MANAGER_SUMMARY.md` | Понятный отчёт для менеджера: что сделано, какие улучшения внесены, что осталось для интеграции в SAYF. |
| `docs/AGENT_MAP.md` | Этот файл — техническая карта проекта для быстрого входа нового агента. |

### Ядро компилятора TW (`src/tw/` — чистая библиотека, 0 внешних зависимостей)
| Путь | Назначение |
|---|---|
| `src/tw/index.ts` | Публичный barrel-экспорт пакета (`compileWidget`, `validateSpec`, `chatDataOf`, `widgetSpecSchema`, `promptGuide`, `catalog`, Bot API хелперы и типы). |
| `src/tw/types.ts` | Все TypeScript-интерфейсы: `WidgetSpec`, 14 узлов каталога, `WidgetState`, `CompileOptions`, `CompileResult`, `WidgetError`, `Result`, а также типы Bot API 10.4 (`SendWidgetParams`, `EditMessageWidgetDataParams`, `AnswerWidgetQueryParams`, `WidgetQuery`). |
| `src/tw/limits.ts` | Жёсткие бюджеты (`HARD_BUDGETS`), лимиты каталога (`LIMITS`), дефолтные служебные знаки (`DEFAULT_SERVICE_WORDS`) и функция `resolveBudgets` (разрешает только ужесточать лимиты). |
| `src/tw/errors.ts` | Конструкторы `ok`/`err` и типизированного объединения ошибок (`invalid_spec`, `link_not_allowed`, `action_too_long`, `chat_data_too_large`, `too_large`). |
| `src/tw/sanitize.ts` | Вычищает `U+0000`, C0 (кроме `\n`, `\t`), C1 и одиночные UTF-16 суррогаты (сохраняя эмодзи и Bidi/RTL); UTF-8/UTF-16 безопасные обрезки `safeSliceChars`, `safeSliceUtf8`. |
| `src/tw/escape.ts` | Контекстное экранирование: `escText`, `escAttr`, `escScriptJson` (`<`, `>`, `&`, `U+2028`, `U+2029` внутри `<script>`). |
| `src/tw/validate.ts` | Рукописный валидатор спецификации без библиотек: собирает **все** нарушения с JSON-путями, проверяет глубину дерева ≤ 4, уникальность `id`, ссылки `bind`/`action`/`link`/`toggles`, HTTPS + `allowedOrigins` + `t.me/<bot>`, запрет вложенных `Tabs`, ≤ 1 `primary`-кнопки в `ButtonRow`. |
| `src/tw/state.ts` | `chatDataOf()` — детерминированная сериализация состояния с сортировкой ключей и проверкой ≤ 1 024 байт UTF-8. |
| `src/tw/caption.ts` | Генератор запасного `caption` (≤ 1 024 знаков, всегда непустой, дописывает полные тексты узлов, усечённых на шаге `truncate`). |
| `src/tw/height.ts` | Консервативный оценщик высоты виджета при ширине 320 px с учётом кириллицы/эмодзи, активного `pageSize`, свёрнутых текстов, макс. вкладки и открытой секции `Accordion`. |
| `src/tw/degrade.ts` | Планировщик деградации по §4.7 (`collapse → paginate → truncate`) с reason-aware пропуском бесполезных шагов (`collapse`/`paginate` пропускаются при `deflated`/`html`, `truncate` на свёрнутом тексте пропускается при `height`). |
| `src/tw/compile.ts` | Главный конвейер `compileWidget`: `validate → sanitize → chatDataOf → render/measure/degrade loop → CompileResult`. |
| `src/tw/schema.ts` | Машиночитаемая JSON Schema `widgetSpecSchema` (Draft 2020-12), метаданные `catalog` и текстовый гайд `promptGuide()` для LLM-ядра SAYF. |
| `src/tw/botapi.ts` | Хелперы Bot API 10.4: `toSendWidgetParams`, `toEditWidgetDataParams`, `answerPayload` (UTF-8-безопасная обрезка до 1 024 байт без разрыва символов). |
| `src/tw/measure-node.ts` | Отдельный Node/Deno-адаптер `deflate9Node` поверх `node:zlib` (`level: 9`). Ядро его не импортирует. |
| `src/tw/presets.ts` | 7 пресетов: все 5 золотых сценариев §6 (`task-card`, `day-8-tasks`, `decision-card`, `ai-reply`, `weekly-report`), демо авто-свёртки (`degrade-demo`) и тест атак/узбекского/эмодзи (`security-uzbek`). |

### Рендерер HTML / CSS / QuickJS-рантайма (`src/tw/render/`)
| Путь | Назначение |
|---|---|
| `src/tw/render/css.ts` | Tree-shakeable каталог CSS-фрагментов в фиксированном порядке; только `var(--tg-theme-*)`, короткие классы (`.c`, `.h`, `.bg`, `.kv`, `.ti`, `.ls`, `.tl`, `.pr`, `.bc`, `.tbb`, `.ac`, `.br`, `.dv`). |
| `src/tw/render/html.ts` | Рендер всех 14 компонентов в компактный HTML-фрагмент (`<style>...</style><div class="c">...</div><script>...</script>`), детерминированные ID, SSR-поддержка `"*"` fallback у `StatusBadge` и скрытие пустого `ButtonRow`. |
| `src/tw/render/runtime.ts` | Модульный ES2023-рантайм (`base`, `bind`, `req`, `link`, `page`, `tabs`, `more`, `acc`): 0 `innerHTML`, упаковка `StatusBadge` в кортежи `[label, tone]`, fallback `"*"`, монотонная проверка ревизии `r`, `HapticFeedback.impactOccurred('light')` на тап, `sessionStorage` строго в `try/catch`. |

### Веб-студия отладки (`src/` — dev-инструмент, не часть пакета шлюза)
| Путь | Назначение |
|---|---|
| `src/main.tsx` | Точка входа React. |
| `src/index.css` | Подключение Tailwind CSS v4. |
| `src/vite-env.d.ts` | Типы клиента Vite (`vite/client`). |
| `src/App.tsx` | Главный экран TW Studio: выбор пресетов, JSON-редактор с живой диагностикой, настройки `allowedOrigins`/`botUsername`/бюджетов, связь с `/api/compile`. |
| `src/components/TelegramSandbox.tsx` | 320 px iframe-песочница Telegram с темой Light/Dark, моком `window.TelegramWidget`, ручным/авто ответом на `widget_query` (включая `RATE_LIMITED`/`TIMEOUT`), редактором живого `editMessageWidgetData` (`chat_data`), `ResizeObserver` замером высоты и логом событий моста. |
| `src/components/BudgetPanel.tsx` | Шкалы всех 5 бюджетов Profile 1, список применённых шагов `degraded`, список попавших в билд CSS- и runtime-кусков. |
| `src/components/OutputPanel.tsx` | Вкладки вывода с копированием: Compiled HTML, Bot API 10.4 `sendWidget`, JSON Schema, `promptGuide()`. |

### CLI-скрипты проверки и замеров (`scripts/`)
| Путь | Назначение |
|---|---|
| `scripts/check-profile1.ts` | Быстрый сторож без Chromium (`npm run check:profile1`): проверяет все пресеты, детерминизм SHA-256, лимиты бюджетов, запреты Profile 1 (`U+0000`, `innerHTML`, `touch-action`, `vh`, `opacity`, `filter`, `text-shadow`, `position: sticky`, `:has`, `:checked`, сетевые API, формы), XSS, `link_not_allowed`, reason-aware деградацию и `"*"` fallback. |
| `scripts/weigh.ts` | Профилировщик маржинального веса в zlib-9 (`npm run weigh [preset-id]`): оценивает вклад `<style>`, `<script>` и каждого узла верхнего уровня. |

---

## 4. Команды быстрой проверки для агента

```bash
npm run check:profile1        # Все инварианты Profile 1, детерминизм, XSS, деградация
npm run weigh                 # Разбивка маржинального веса zlib-9 по всем пресетам
npm run weigh day-8-tasks     # Вес конкретного пресета
npm run lint                  # Строгая проверка типов (tsc --noEmit)
npm run build                 # Продакшен-сборка фронтенда (vite build)
npm run dev                   # Запуск TW Studio + API на http://0.0.0.0:3000
```

## 5. Известные следующие шаги (бэклог из ревью и `PLAN.md`)

1. Проверить формат `StatusBadge.options` на переход к массиву `[{ key, label, tone }]` для лучшей совместимости с LLM Structured Outputs (и убрать `actions`/`links` из LLM-схемы).
2. Развернуть `vendor/widget-sandbox` (Chromium + QuickJS) из `scripts/setup-vendor.sh` внутри `tw-handoff.zip` и откалибровать `src/tw/height.ts` + проверить `env(safe-area-inset-bottom)` при обязательном `caption`.
3. Добавить `vitest` + `fast-check` (property-based fuzzing) и проверку совместимости с `deno task check` (импорт-мап для общих тестов).
4. Убедиться, что `src/tw/` экспортируется в `packages/telegram-widgets` отдельно от веб-студии (`src/App.tsx`, `src/components/`, `server.ts`).
