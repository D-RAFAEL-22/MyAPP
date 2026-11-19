import { HARD_BUDGETS } from './limits.ts';
import { safeSliceUtf8, sanitizeString } from './sanitize.ts';
import type {
  AnswerWidgetQueryParams,
  CompileResult,
  EditMessageWidgetDataParams,
  SendWidgetParams,
} from './types.ts';

export function toSendWidgetParams(
  chatId: number | string,
  compiled: CompileResult,
  extra: Partial<Omit<SendWidgetParams, 'chat_id' | 'html' | 'chat_data' | 'caption'>> = {},
): SendWidgetParams {
  return {
    chat_id: chatId,
    html: compiled.html,
    chat_data: compiled.chatData,
    caption: compiled.caption,
    allow_queries: extra.allow_queries ?? true,
    protect_content: extra.protect_content ?? true,
    ...extra,
  };
}

export function toEditWidgetDataParams(
  target: { chat_id: number | string; message_id: number } | { inline_message_id: string },
  chatData: string,
): EditMessageWidgetDataParams {
  return {
    ...target,
    chat_data: chatData,
  };
}

/**
 * Builds an answerWidgetQuery payload safely bounded to 1,024 UTF-8 bytes
 * without ever splitting a multibyte UTF-8 character or UTF-16 surrogate pair.
 */
export function answerPayload(
  widgetQueryId: string,
  resultText: string,
  maxBytes: number = HARD_BUDGETS.chatDataBytes,
): AnswerWidgetQueryParams {
  const clean = sanitizeString(resultText);
  // Reserve JSON wrapper overhead `{"result":""}` (13 bytes)
  const wrapper = '{"result":""}';
  const maxInnerBytes = Math.max(0, maxBytes - wrapper.length);

  let text = clean;
  let encoded = JSON.stringify({ result: text });
  const enc = new TextEncoder();

  if (enc.encode(encoded).length > maxBytes) {
    text = safeSliceUtf8(clean, maxInnerBytes);
    encoded = JSON.stringify({ result: text });
    while (enc.encode(encoded).length > maxBytes && text.length > 0) {
      text = safeSliceUtf8(text, Math.max(0, enc.encode(text).length - 4));
      encoded = JSON.stringify({ result: text });
    }
  }

  return {
    widget_query_id: widgetQueryId,
    data: encoded,
  };
}
