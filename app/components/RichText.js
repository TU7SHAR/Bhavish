import { mdToHtml } from "../../lib/markdown";

// Renders report/guidance text that may contain light Markdown (**bold**,
// headings, "- " bullets) as formatted HTML instead of showing raw asterisks.
// Replaces the previous `whitespace-pre-line` raw rendering everywhere.
export default function RichText({ text, className = "" }) {
  if (text === null || text === undefined || text === "") return null;
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: mdToHtml(text) }}
    />
  );
}
