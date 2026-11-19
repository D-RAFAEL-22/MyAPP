import { deflateSync } from 'node:zlib';
import type { Deflate9 } from './types.ts';

/**
 * Node.js zlib level-9 byte length measurement adapter.
 * Kept separate from core so core stays 100% platform/dependency free.
 */
export const deflate9Node: Deflate9 = (bytes: Uint8Array): number => {
  return deflateSync(bytes, { level: 9 }).length;
};
