import type { CompileSizes, Result, ValidationIssue, WidgetError } from './types.ts';

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends WidgetError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function invalidSpec(issues: ValidationIssue[]): WidgetError {
  return { code: 'invalid_spec', issues };
}

export function linkNotAllowed(path: string, url: string): WidgetError {
  return { code: 'link_not_allowed', path, url };
}

export function actionTooLong(path: string, bytes: number): WidgetError {
  return { code: 'action_too_long', path, bytes };
}

export function chatDataTooLarge(bytes: number): WidgetError {
  return { code: 'chat_data_too_large', bytes };
}

export function tooLarge(
  sizes: CompileSizes,
  degraded: string[],
  reason: 'deflated' | 'html' | 'height',
): WidgetError {
  return { code: 'too_large', sizes, degraded, reason };
}
