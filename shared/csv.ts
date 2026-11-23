/**
 * CSV helpers shared by the admin exports and their tests.
 *
 * Spreadsheet applications evaluate a cell as a formula when its text starts
 * with `=`, `+`, `-` or `@`, and some also do so after leading whitespace or a
 * control character (tab, carriage return, NBSP, zero-width characters, ...).
 * A subscriber could therefore sign up with an address such as
 * `=HYPERLINK("https://evil.example","x")@mail.example` and attack whoever opens
 * the export. Such cells are prefixed with a single quote, which spreadsheets
 * treat as "this is text", and only then quoted for CSV.
 */

/** Whitespace and invisible/control characters that spreadsheets skip over. */
const SKIPPED_LEADING =
  // eslint-disable-next-line no-control-regex
  /^[\u0000-\u0020\u007f-\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff]*/;
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@"]);

/** True when a spreadsheet could interpret `value` as a formula or command. */
export function isFormulaLike(value: string): boolean {
  if (!value) return false;
  // A leading tab or carriage return is itself a known injection vector.
  if (value[0] === "\t" || value[0] === "\r") return true;
  const rest = value.slice(SKIPPED_LEADING.exec(value)?.[0].length ?? 0);
  return rest.length > 0 && FORMULA_TRIGGERS.has(rest[0]);
}

/** Neutralise formula-looking text without changing anything else. */
export function neutralizeFormula(value: string): string {
  return isFormulaLike(value) ? `'${value}` : value;
}

/** Sanitise, then quote a single CSV cell (RFC 4180 quoting). */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${neutralizeFormula(text).replace(/"/g, '""')}"`;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
