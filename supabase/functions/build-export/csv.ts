/**
 * RFC 4180 CSV, written by hand.
 *
 * Three deliberate choices, all of them about the program on the other side —
 * which is a spreadsheet on somebody's laptop, not a parser we control:
 *
 *  1. **CRLF line endings and doubled quotes**, because that is what the
 *     standard says and what Excel, Numbers and pandas all agree on.
 *  2. **A UTF-8 byte-order mark.** Excel on Windows reads a BOM-less UTF-8 file
 *     as the system code page, which turns every accented brand name and every
 *     em-dash in a note into mojibake. The BOM is three bytes and it is the
 *     difference between an export that opens correctly and one that looks
 *     corrupted.
 *  3. **No formula-injection prefixing.** The usual advice is to prefix a cell
 *     starting with `=`, `+`, `-` or `@` with an apostrophe. This file does not,
 *     because the reader of the file is its subject: this is one person's own
 *     wardrobe going to that person, and silently rewriting `-- vintage` to
 *     `'-- vintage` corrupts the data the export exists to hand back. The only
 *     text here that another person typed is the title, venue and note of an
 *     occasion the user was invited to, which they can already read in the app.
 */

/** A cell needs quoting only for these; everything else goes out bare. */
const NEEDS_QUOTE = /[",\r\n]/;

export type Cell = string | number | boolean | null | undefined;

/** `['navy', 'wool']` → `navy; wool`. Empty and all-empty lists become ''. */
export function list(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (!Array.isArray(value)) return String(value);
  return value
    .map((entry) => (entry === null || entry === undefined ? '' : String(entry)))
    .filter((entry) => entry.length > 0)
    .join('; ');
}

/**
 * A jsonb column, rendered so a person can read it.
 *
 * `colors` is an array that has been two different shapes across the schema's
 * life — bare hex strings early on, `{ hex, name }` objects since the palette
 * work — so this reads whichever it is given rather than asserting one. Anything
 * it does not recognise falls through to compact JSON, which is ugly but never
 * lossy, and losing a field out of a data export is the one failure that is not
 * allowed here.
 */
export function readable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined) return '';
        if (typeof entry === 'object') {
          const o = entry as Record<string, unknown>;
          const label = o.name ?? o.label ?? o.hex ?? o.value;
          return label === undefined ? JSON.stringify(entry) : String(label);
        }
        return String(entry);
      })
      .filter((entry) => entry.length > 0)
      .join('; ');
  }
  return JSON.stringify(value);
}

/** Compact JSON for the columns that genuinely are structured data. */
export function json(value: unknown): string {
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function cell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  return NEEDS_QUOTE.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header row plus body, as one string ready to go into the zip. */
export function csvDocument(headers: string[], rows: Cell[][]): string {
  const lines: string[] = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
