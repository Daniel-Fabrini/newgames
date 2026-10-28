/** Test helper: builds a flat board from row strings (digits 1–9, '.' = cleared cell). */
export function board(...rows: string[]): number[] {
  return rows
    .join('')
    .split('')
    .map((ch) => (ch === '.' ? 0 : Number(ch)));
}
