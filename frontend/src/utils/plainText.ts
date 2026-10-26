/**
 * Narratives are shown as plain paragraphs and read aloud, so markdown that a
 * model (or an older saved story) left in the text would be printed as "**" and
 * spoken by the narrator. This removes the marks and remembers which lines
 * were marked as headings ("**Orientation**", "## History"), so the reader can
 * still style them as headings.
 */
export interface ReadableNarrative {
  text: string;
  /** Lines (trimmed) that the source marked as headings. */
  headings: Set<string>;
}

const HEADING_LINE = /^\s*(?:#{1,6}\s+(.+?)\s*#*|\*\*(.+?)\*\*:?|__(.+?)__:?)\s*$/;

function stripInline(line: string) {
  return line
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/^(\s*)\*\s+/, "$1- ")
    .replace(/\*\*/g, "");
}

export function readableNarrative(raw: string): ReadableNarrative {
  const headings = new Set<string>();
  const text = raw
    .split("\n")
    .map((line) => {
      const match = line.match(HEADING_LINE);
      if (!match) return stripInline(line);
      const heading = stripInline(match[1] ?? match[2] ?? match[3] ?? "").trim();
      if (heading) headings.add(heading);
      return heading;
    })
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, headings };
}

/** Plain text only, for places that show a narrative without the reader. */
export function plainNarrative(raw: string) {
  return readableNarrative(raw).text;
}
