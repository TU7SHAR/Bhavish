// Lightweight, dependency-free Markdown -> HTML converter.
//
// Gemini frequently emits light Markdown in report/guidance text
// (**bold**, headings with #, and "- " / "* " bullet lists). Rendering that
// raw left literal asterisks and hashes visible to customers. This helper
// converts the small subset of Markdown we actually produce into safe HTML.
//
// It is used both server-side (email HTML, PDF) and client-side (via the
// RichText component) so report text renders identically everywhere.

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Inline formatting within a single line: **bold** / __bold__ then *italic*.
// Input is escaped first so any user/AI angle brackets can't inject markup.
function inlineToHtml(text) {
  let t = escapeHtml(text);
  t = t.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+?)__/g, "<strong>$1</strong>");
  // Single-asterisk italics — only when clearly paired and not a bullet marker.
  t = t.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1<em>$2</em>");
  // Strip any leftover stray asterisks so customers never see raw "*".
  t = t.replace(/\*/g, "");
  return t;
}

// Convert a block of Markdown-ish text into HTML with <strong>, bullets and
// <br> line breaks. Safe to inject via dangerouslySetInnerHTML.
export function mdToHtml(text) {
  if (text === null || text === undefined) return "";
  const lines = String(text).split(/\r?\n/);
  return lines
    .map((raw) => {
      const line = raw.replace(/\s+$/, "");
      if (line.trim() === "") return "<br>";
      const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
      if (heading) return `<strong>${inlineToHtml(heading[1])}</strong><br>`;
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) return `&bull;&nbsp;${inlineToHtml(bullet[1])}<br>`;
      return `${inlineToHtml(line)}<br>`;
    })
    .join("");
}

// Plain-text version: strips Markdown markers without adding HTML. Useful for
// PDF text nodes or anywhere HTML isn't rendered.
export function mdToPlain(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/__([^_]+?)__/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "\u2022 ")
    .replace(/\*/g, "");
}
