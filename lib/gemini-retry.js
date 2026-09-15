import { GoogleGenerativeAI } from "@google/generative-ai";

// Retry + multi-model fallback wrapper for Gemini calls.
//
// WHY: Gemini free tier throws 503 "model is experiencing high demand" in
// bursts (this took down generate-email-sequence and draft-reply on 2026-09-15).
// This wrapper keeps the SAME signature every route already uses —
// generateWithRetry(model, prompt) — so NOTHING at the call sites changes.
//
// STRATEGY (voice-preserving):
//   gemini-3.1-flash-lite is the PRIMARY on purpose — it has the best
//   astrologer "roleplay" voice for this product. We do NOT switch models to
//   chase quality; fallbacks fire ONLY when the primary is literally
//   unavailable (503/overloaded), and they are ordered by TONAL closeness to
//   the primary (the other -lite model first, a Flash model only as a last
//   resort). So on a healthy day, 100% of calls use the primary — same voice,
//   same token cost as before.
//
//   1. primary model, retried with backoff (503s are usually seconds long)
//   2. if still failing → HEDGE: fire (primary again) + (closest sibling) in
//      parallel, take the first success, but PREFER the primary's result if it
//      lands within a short grace window (keeps the voice)
//   3. if both fail → next fallback model
//   4. exhausted → throw the last error (identical to old behaviour)
//
// FAIL-SAFE BY CONSTRUCTION: if we can't determine the primary model name, or
// building a fallback model throws for any reason, we silently behave EXACTLY
// like the old wrapper (retry the passed-in model only). It can never do worse
// than before.

// Ordered by tonal closeness to the primary. Only used as rescue on 503.
// Configurable: reorder/trim freely; unknown model IDs simply get skipped.
const FALLBACK_CHAIN = [
  "gemini-3.5-flash-lite", // same "lite" family → closest voice
  "gemini-3.8-flash",      // last resort: best quality, different voice
];

// How long to wait for the preferred (primary) result before accepting a
// hedged sibling's result. Keeps the primary's voice when it's only slightly slow.
const PRIMARY_GRACE_MS = 1500;

function is503(error) {
  return (
    error?.status === 503 ||
    error?.status === 429 || // rate-limited counts as "unavailable, try elsewhere"
    error?.message?.includes("503") ||
    error?.message?.includes("429") ||
    error?.message?.toLowerCase?.().includes("overloaded") ||
    error?.message?.toLowerCase?.().includes("high demand") ||
    error?.message?.toLowerCase?.().includes("unavailable")
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Best-effort read of the model id + generationConfig off the SDK model object,
// so a fallback model is built with the same settings (maxOutputTokens, temp).
// Returns null if we can't safely introspect — caller then skips fallback.
function readModelSpec(model) {
  try {
    // The SDK stores these on the instance; names have been stable, but we
    // guard every access so a shape change can't throw.
    const modelName =
      model?.model || model?._model || model?.modelName || null;
    const generationConfig = model?.generationConfig || model?._generationConfig || undefined;
    const id = typeof modelName === "string" ? modelName.replace(/^models\//, "") : null;
    return id ? { id, generationConfig } : null;
  } catch {
    return null;
  }
}

function buildModel(modelId, generationConfig) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel(
    generationConfig ? { model: modelId, generationConfig } : { model: modelId }
  );
}

// Try one model with backoff retries. Throws on final failure.
async function tryModelWithRetry(model, prompt, maxRetries, label) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;
      if (is503(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`Gemini 503 on ${label} attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Drop-in replacement for the old generateWithRetry — SAME signature.
 *
 * @param {object} model      a Gemini model from getGenerativeModel()
 * @param {string} prompt
 * @param {number} maxRetries retries for the PRIMARY model (default 3, unchanged)
 * @returns the model.generateContent() result
 */
export async function generateWithRetry(model, prompt, maxRetries = 3) {
  const spec = readModelSpec(model);

  // 1. PRIMARY first, alone, with the original retry behaviour.
  try {
    return await tryModelWithRetry(model, prompt, maxRetries, spec?.id || "primary");
  } catch (primaryError) {
    // Only consider fallbacks for availability errors, and only if we could
    // safely introspect the model. Anything else → behave exactly like before.
    if (!is503(primaryError) || !spec) throw primaryError;

    // Build the fallback model list (skip the primary's own id if it appears).
    const fallbackIds = FALLBACK_CHAIN.filter((id) => id && id !== spec.id);
    if (fallbackIds.length === 0) throw primaryError;

    console.warn(`[llm] primary ${spec.id} unavailable — trying fallbacks: ${fallbackIds.join(", ")}`);

    // 2. HEDGE on the FIRST fallback: race a fresh primary attempt against the
    //    closest sibling, but give the primary a short head-start-preference so
    //    its voice wins when it's merely slow. If either throws we ignore it and
    //    fall through to the sequential chain below.
    try {
      const firstFallbackId = fallbackIds[0];
      let primaryLanded = null;
      let siblingLanded = null;

      const primaryAttempt = (async () => {
        try { primaryLanded = await buildModel(spec.id, spec.generationConfig).generateContent(prompt); }
        catch { primaryLanded = null; }
      })();
      const siblingAttempt = (async () => {
        try { siblingLanded = await buildModel(firstFallbackId, spec.generationConfig).generateContent(prompt); }
        catch { siblingLanded = null; }
      })();

      // Wait for whichever finishes first.
      await Promise.race([primaryAttempt, siblingAttempt]);

      // If the primary won, use it immediately (best voice).
      if (primaryLanded) return primaryLanded;

      // The sibling finished first. Give the primary a short grace window to
      // also land, so we still prefer its voice when it's only slightly behind.
      if (siblingLanded) {
        await Promise.race([primaryAttempt, sleep(PRIMARY_GRACE_MS)]);
        if (primaryLanded) return primaryLanded;
        console.warn(`[llm] served by fallback ${firstFallbackId} (primary still unavailable)`);
        return siblingLanded;
      }

      // Neither has landed yet — wait for both to settle, prefer primary.
      await Promise.allSettled([primaryAttempt, siblingAttempt]);
      if (primaryLanded) return primaryLanded;
      if (siblingLanded) {
        console.warn(`[llm] served by fallback ${firstFallbackId}`);
        return siblingLanded;
      }
    } catch {
      // Hedge machinery failed unexpectedly — fall through to sequential.
    }

    // 3. Sequential try of any remaining fallback models (skip the one hedged).
    let lastError = primaryError;
    for (const id of fallbackIds.slice(1)) {
      try {
        const result = await buildModel(id, spec.generationConfig).generateContent(prompt);
        console.warn(`[llm] served by fallback ${id}`);
        return result;
      } catch (e) {
        lastError = e;
      }
    }

    // 4. Everything failed → throw, same as the old wrapper would.
    throw lastError;
  }
}
