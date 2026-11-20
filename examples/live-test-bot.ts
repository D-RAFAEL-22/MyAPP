/**
 * examples/live-test-bot.ts — Live Bot API 10.4 smoke-test script (NOT part of src/tw/).
 *
 * Sends a compiled TW widget to your private chat with a test bot, then listens
 * via getUpdates for `widget_query` taps, answers with `answerWidgetQuery`,
 * and pushes a live `editMessageWidgetData` state update.
 *
 * Usage (secrets ONLY via env vars, never commit tokens):
 *   BOT_TOKEN="123456:ABC..." CHAT_ID="987654321" npm run test:live-bot
 *   PRESET=day-8-tasks BOT_TOKEN="..." CHAT_ID="..." npm run test:live-bot
 */
import {
  answerPayload,
  chatDataOf,
  compileWidget,
  toEditWidgetDataParams,
  toSendWidgetParams,
} from '../src/tw/index.ts';
import { deflate9Node } from '../src/tw/measure-node.ts';
import { WIDGET_PRESETS } from '../src/tw/presets.ts';

const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const CHAT_ID = process.env.CHAT_ID?.trim();
const PRESET_ID = process.env.PRESET?.trim() || 'task-card';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN?.trim() || 'https://acme.sayf.example';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Missing env vars. Run with:');
  console.error('  BOT_TOKEN="<your_test_bot_token>" CHAT_ID="<your_private_chat_id>" npm run test:live-bot');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tgCall<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; error_code?: number; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed (${json.error_code}): ${json.description}`);
  }
  return json.result as T;
}

const preset = WIDGET_PRESETS.find((p) => p.id === PRESET_ID);
if (!preset) {
  console.error(`Unknown PRESET="${PRESET_ID}". Available: ${WIDGET_PRESETS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}

const compiled = compileWidget(preset.spec, {
  deflate9: deflate9Node,
  allowedOrigins: [ALLOWED_ORIGIN],
});

if (!compiled.ok) {
  console.error('Compile failed:', compiled.error);
  process.exit(1);
}

console.log(
  `Compiled "${preset.id}": ${compiled.value.sizes.deflatedBytes} B zlib-9 / ${compiled.value.sizes.utf8Bytes} B UTF-8 / est ${compiled.value.sizes.predictedHeight320} px`,
);

const sendParams = toSendWidgetParams(CHAT_ID, compiled.value);
let sentMessageId: number;

try {
  const msg = await tgCall<{ message_id: number }>('sendWidget', sendParams as unknown as Record<string, unknown>);
  sentMessageId = msg.message_id;
  console.log(`SUCCESS: sendWidget delivered! message_id=${sentMessageId}`);
  console.log('Open your private chat with the bot on Android / iOS / Desktop and tap any request button.');
  console.log('Waiting for widget_query updates (Ctrl+C to stop)...\n');
} catch (err) {
  console.error(String(err));
  process.exit(1);
}

let offset = 0;
let rev = Number(preset.spec.state.r ?? 1);

interface UpdateItem {
  update_id: number;
  widget_query?: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    data?: string;
  };
}

while (true) {
  try {
    const updates = await tgCall<UpdateItem[]>('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['widget_query'],
    });

    for (const u of updates) {
      offset = u.update_id + 1;
      const wq = u.widget_query;
      if (!wq) continue;

      console.log(`<- widget_query from @${wq.from.username ?? wq.from.id}: data="${wq.data ?? ''}"`);

      const answer = answerPayload(wq.id, `Принято: ${wq.data ?? 'ok'}`);
      await tgCall('answerWidgetQuery', answer as unknown as Record<string, unknown>);
      console.log(`-> answerWidgetQuery sent (${answer.data})`);

      // Push live chat_data update on task-card / decision-card
      if (preset.id === 'task-card' || preset.id === 'decision-card') {
        rev += 1;
        const nextState =
          preset.id === 'task-card'
            ? { r: rev, status: 'done', progress: 100, act: [] }
            : { r: rev, decision: 'approved', act: [] };
        const nextData = chatDataOf(preset.spec, nextState);
        if (nextData.ok) {
          const editParams = toEditWidgetDataParams(
            { chat_id: CHAT_ID, message_id: sentMessageId },
            nextData.value,
          );
          await tgCall('editMessageWidgetData', editParams as unknown as Record<string, unknown>);
          console.log(`-> editMessageWidgetData pushed: ${nextData.value}\n`);
        }
      }
    }
  } catch (err) {
    console.error('Poll error:', String(err));
    await new Promise((r) => setTimeout(r, 2000));
  }
}
