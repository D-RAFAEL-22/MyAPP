import { chatDataTooLarge, err, invalidSpec, ok } from './errors.ts';
import { HARD_BUDGETS, LIMITS } from './limits.ts';
import { sanitizeString, utf8Length } from './sanitize.ts';
import type { Result, StatePrimitive, WidgetError, WidgetSpec, WidgetState } from './types.ts';

/**
 * Deterministically serializes WidgetState to Telegram chat_data JSON (sorted keys, <= 1024 UTF-8 bytes).
 */
export function chatDataOf(
  _spec: WidgetSpec,
  state: WidgetState,
  maxBytes: number = HARD_BUDGETS.chatDataBytes,
): Result<string, WidgetError> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return err(invalidSpec([{ path: 'state', message: 'state must be a flat object' }]));
  }
  if (typeof state.r !== 'number' || !Number.isInteger(state.r) || state.r < 0) {
    return err(invalidSpec([{ path: 'state.r', message: 'state.r must be an integer >= 0' }]));
  }

  const sortedKeys = Object.keys(state).sort();
  const normalized: Record<string, StatePrimitive> = {};

  for (const key of sortedKeys) {
    const val = state[key];
    if (val === undefined) continue;
    if (!LIMITS.stateKeyRegex.test(key)) {
      return err(
        invalidSpec([{ path: `state.${key}`, message: 'state key must match ^[a-z][a-z0-9_]{0,15}$' }]),
      );
    }
    if (typeof val === 'string') {
      const clean = sanitizeString(val);
      if (clean.length > LIMITS.stateStringMax) {
        return err(
          invalidSpec([
            { path: `state.${key}`, message: `string value exceeds ${LIMITS.stateStringMax} chars` },
          ]),
        );
      }
      normalized[key] = clean;
    } else if (typeof val === 'number') {
      if (!Number.isInteger(val)) {
        return err(invalidSpec([{ path: `state.${key}`, message: 'numeric state values must be integers' }]));
      }
      normalized[key] = val;
    } else if (typeof val === 'boolean') {
      normalized[key] = val;
    } else if (Array.isArray(val)) {
      if (key !== 'act') {
        return err(invalidSpec([{ path: `state.${key}`, message: 'array state value is only allowed for "act"' }]));
      }
      const cleanArr: string[] = [];
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] !== 'string') {
          return err(invalidSpec([{ path: `state.act[${i}]`, message: 'act items must be strings' }]));
        }
        cleanArr.push(sanitizeString(val[i]));
      }
      normalized[key] = cleanArr;
    } else {
      return err(invalidSpec([{ path: `state.${key}`, message: 'unsupported state value type' }]));
    }
  }

  const json = JSON.stringify(normalized);
  const bytes = utf8Length(json);
  if (bytes > maxBytes) {
    return err(chatDataTooLarge(bytes));
  }
  return ok(json);
}
