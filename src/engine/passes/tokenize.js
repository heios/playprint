/**
 * Pass 1/6: tokenize
 *
 * Turns `state.text` into a document of rows of tokens (cards-to-be).
 * SPEC.md user stories 1–9: whitespace splits tokens, newlines force row
 * breaks, blank lines produce empty rows, duplicate tokens are kept as-is.
 *
 * Input:  { state, env }
 * Output: { state, env, doc: { rows: string[][] } }
 *
 * This is a stub for issue #1 (scaffold only) — full tokenization rules
 * (soft-wrap, blank-line rows, etc.) land with the layout-engine slices.
 */
export function tokenize({ state, env }) {
  const text = state?.text ?? "";
  const rows = text.length === 0 ? [] : text.split("\n").map((line) => line.split(/\s+/).filter(Boolean));

  return { state, env, doc: { rows } };
}
