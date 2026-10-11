// Spreadsheet-safe export helpers: text starting with = + - @ (or tab/CR) is
// prefixed with an apostrophe so spreadsheet apps never run it as a formula.
export function neutralizeCell(value: unknown): string {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Quoted, escaped, formula-safe CSV cell. */
export function csvQ(value: unknown): string {
  return `"${neutralizeCell(value).replace(/"/g, '""')}"`;
}

/** Formula-safe copies of rows for spreadsheet sheets. */
export function safeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' ? neutralizeCell(v) : v;
    return out as T;
  });
}

/** Escapes text for HTML output. */
export function escHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
