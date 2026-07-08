/**
 * Input sanitization utilities for BhavishAI.
 * Prevents prompt injection, XSS, and other input-based attacks.
 */

/**
 * Sanitizes user input that will be interpolated into AI prompts.
 * Strips potential prompt injection patterns while preserving legitimate content.
 * 
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowed length (default: 500)
 * @returns {string} - Sanitized input safe for prompt inclusion
 */
export function sanitizeForPrompt(input, maxLength = 500) {
  if (!input || typeof input !== "string") return "";

  let clean = input;

  // 1. Truncate to max length first (prevents large payload attacks)
  clean = clean.slice(0, maxLength);

  // 2. Strip HTML/XML tags
  clean = clean.replace(/<[^>]*>/g, "");

  // 3. Remove common prompt injection patterns
  // These patterns try to override AI instructions
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /ignore\s+(all\s+)?above\s+instructions/gi,
    /disregard\s+(all\s+)?previous/gi,
    /forget\s+(all\s+)?previous/gi,
    /you\s+are\s+now\s+/gi,
    /act\s+as\s+(if\s+you\s+are\s+)?/gi,
    /pretend\s+(you\s+are|to\s+be)\s+/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<<\/SYS>>/gi,
    /```\s*(system|instruction|prompt)/gi,
    /output\s+(your|the)\s+(system\s+)?prompt/gi,
    /reveal\s+(your|the)\s+(system\s+)?prompt/gi,
    /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions)/gi,
  ];

  for (const pattern of injectionPatterns) {
    clean = clean.replace(pattern, "[filtered]");
  }

  // 4. Remove control characters and null bytes
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 5. Normalize whitespace (collapse multiple spaces/newlines)
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

/**
 * Sanitizes user input for safe HTML rendering (XSS prevention).
 * Use this for content that will be rendered in emails or browser.
 * 
 * @param {string} input - Raw user input
 * @returns {string} - HTML-safe string
 */
export function sanitizeForHtml(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes a name field (allows letters, spaces, common name characters).
 * 
 * @param {string} name - Raw name input
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {string} - Sanitized name
 */
export function sanitizeName(name, maxLength = 100) {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{M}\s.'\-]/gu, "")
    .slice(0, maxLength)
    .trim();
}

/**
 * Sanitizes place/location input.
 * Allows letters, numbers, spaces, commas, and common location punctuation.
 * 
 * @param {string} place - Raw place input
 * @param {number} maxLength - Maximum allowed length (default: 200)
 * @returns {string} - Sanitized place
 */
export function sanitizePlace(place, maxLength = 200) {
  if (!place || typeof place !== "string") return "";
  return place
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s,.\-'()]/gu, "")
    .slice(0, maxLength)
    .trim();
}
