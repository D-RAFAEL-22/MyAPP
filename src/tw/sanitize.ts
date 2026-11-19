/**
 * Strips U+0000, C0 control chars (except \n and \t), C1 control chars (U+007F..U+009F),
 * and lone UTF-16 surrogates. Preserves valid surrogate pairs (emoji) and Bidi controls.
 */
export function sanitizeString(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);

    // High surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 < input.length) {
        const next = input.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          out += input[i] + input[i + 1];
          i++;
          continue;
        }
      }
      // Drop lone high surrogate
      continue;
    }

    // Drop lone low surrogate
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    // Strip U+0000 and C0 controls except \t (0x09) and \n (0x0A)
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a) {
      continue;
    }

    // Strip DEL and C1 controls (0x7F..0x9F)
    if (code >= 0x7f && code <= 0x9f) {
      continue;
    }

    out += input[i];
  }
  return out;
}

export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      res[k] = sanitizeDeep(v);
    }
    return res as T;
  }
  return value;
}

export function utf8Length(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Truncates a string to at most maxChars UTF-16 units without splitting a surrogate pair.
 */
export function safeSliceChars(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  if (maxChars <= 0) return '';
  let end = maxChars;
  const last = str.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) {
    end--;
  }
  return str.slice(0, end);
}

/**
 * Truncates a string to at most maxBytes UTF-8 bytes without splitting multibyte UTF-8 characters or surrogate pairs.
 */
export function safeSliceUtf8(str: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(str).length <= maxBytes) return str;
  let bytes = 0;
  let out = '';
  for (const ch of str) {
    const chBytes = enc.encode(ch).length;
    if (bytes + chBytes > maxBytes) break;
    out += ch;
    bytes += chBytes;
  }
  return out;
}
