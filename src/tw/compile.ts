import { buildCaption } from './caption.ts';
import { buildDegradationPlan } from './degrade.ts';
import { err, invalidSpec, ok, tooLarge } from './errors.ts';
import { estimateHeight320, type RenderPlanOverrides } from './height.ts';
import { DEFAULT_SERVICE_WORDS, resolveBudgets } from './limits.ts';
import { assignDeterministicIds, findToggleTargets, renderSpecToHtml } from './render/html.ts';
import { sanitizeDeep, utf8Length } from './sanitize.ts';
import { chatDataOf } from './state.ts';
import type {
  CompileOptions,
  CompileResult,
  CompileSizes,
  ResolvedServiceWords,
  Result,
  WidgetError,
} from './types.ts';
import { validateSpec } from './validate.ts';

function resolveWords(
  optWords?: CompileOptions['words'],
  specWords?: CompileOptions['words'],
): ResolvedServiceWords {
  return {
    pending: specWords?.pending ?? optWords?.pending ?? DEFAULT_SERVICE_WORDS.pending,
    failed: specWords?.failed ?? optWords?.failed ?? DEFAULT_SERVICE_WORDS.failed,
    busy: specWords?.busy ?? optWords?.busy ?? DEFAULT_SERVICE_WORDS.busy,
    notAllowed: specWords?.notAllowed ?? optWords?.notAllowed ?? DEFAULT_SERVICE_WORDS.notAllowed,
    ellipsis: specWords?.ellipsis ?? optWords?.ellipsis ?? DEFAULT_SERVICE_WORDS.ellipsis,
  };
}

/**
 * Compiles a WidgetSpec JSON object into a Telegram Bot API 10.4 Profile 1 HTML widget.
 * Never throws on any input — returns Result<CompileResult, WidgetError>.
 */
export function compileWidget(
  rawSpec: unknown,
  opts: CompileOptions,
): Result<CompileResult, WidgetError> {
  try {
    const validated = validateSpec(rawSpec, {
      allowedOrigins: opts.allowedOrigins,
      botUsername: opts.botUsername,
    });
    if (!validated.ok) return validated;

    const spec = sanitizeDeep(validated.value);
    const budgets = resolveBudgets(opts.limits);
    const words = resolveWords(opts.words, spec.words);

    // Check chat_data budget first
    const chatDataRes = chatDataOf(spec, spec.state, budgets.chatDataBytes);
    if (!chatDataRes.ok) return chatDataRes;
    const chatData = chatDataRes.value;
    const chatDataBytes = utf8Length(chatData);

    const idMap = assignDeterministicIds(spec);
    const hiddenToggleTargets = findToggleTargets(spec);

    const overrides: RenderPlanOverrides = {
      collapsedTextIds: new Set<string>(),
      listPageSizes: new Map<string, number>(),
      truncatedTexts: new Map<string, number>(),
      hiddenToggleTargets,
    };

    const degradationSteps = buildDegradationPlan(spec, idMap);
    const appliedDegraded: string[] = [];
    const truncatedFullTexts: string[] = [];

    const encoder = new TextEncoder();

    const measureOnce = () => {
      const rendered = renderSpecToHtml(spec, overrides, idMap, words);
      const htmlBytesArr = encoder.encode(rendered.html);
      const utf8Bytes = htmlBytesArr.length;
      const deflatedBytes = opts.deflate9(htmlBytesArr);
      const predictedHeight320 = estimateHeight320(spec, overrides, idMap);
      const caption = buildCaption(spec, truncatedFullTexts, budgets.captionChars, words.ellipsis);

      const sizes: CompileSizes = {
        utf8Bytes,
        deflatedBytes,
        chatDataBytes,
        captionChars: caption.length,
        predictedHeight320,
      };

      const failReason: 'deflated' | 'html' | 'height' | null =
        utf8Bytes > budgets.htmlBytes
          ? 'html'
          : deflatedBytes > budgets.deflated
            ? 'deflated'
            : predictedHeight320 > budgets.height320
              ? 'height'
              : null;

      return { rendered, caption, sizes, failReason };
    };

    let attempt = measureOnce();
    const usedSteps = new Set<number>();

    while (attempt.failReason !== null) {
      const nextIdx = degradationSteps.findIndex(
        (step, idx) => !usedSteps.has(idx) && step.appliesTo(attempt.failReason!, overrides),
      );
      if (nextIdx === -1) break;
      usedSteps.add(nextIdx);
      const step = degradationSteps[nextIdx];
      step.apply(overrides, truncatedFullTexts);
      appliedDegraded.push(step.label);
      attempt = measureOnce();
    }

    if (attempt.failReason !== null) {
      return err(tooLarge(attempt.sizes, appliedDegraded, attempt.failReason));
    }

    return ok({
      html: attempt.rendered.html,
      chatData,
      caption: attempt.caption,
      sizes: attempt.sizes,
      degraded: appliedDegraded,
      usedCssKeys: attempt.rendered.usedCssKeys,
      usedRuntimeKeys: attempt.rendered.usedRuntimeKeys,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(invalidSpec([{ path: '$', message: `Unexpected compiler error: ${msg}` }]));
  }
}
