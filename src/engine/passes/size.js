/**
 * Pass 2/6: size
 *
 * Measures each token via `env.measureText`, then decides the shared card
 * footprint (SPEC.md user stories 10–15). Preserves row structure so `place`
 * can honour hard row breaks and empty rows.
 *
 * The inner border encloses the measured word plus `card.paddingMm` on every
 * side. In `uniform` sizing every card takes the widest such footprint, so
 * columns align (the "same space" invariant); in `fit` sizing each card hugs
 * its own width but all share the uniform height. Issue #2 ships `uniform`;
 * the `fit` branch is written so a later slice drops in without changing the
 * pass boundary.
 *
 * Input:  { state, env, doc: { rows } }
 * Output: { state, env, doc: { rows, cards: SizedCard[] } }
 *   SizedCard: {
 *     token, row, col,
 *     textWidthMm, textHeightMm,   // measured glyph run
 *     innerWidthMm, innerHeightMm, // inner border box (text + padding)
 *   }
 */
export function size({ state, env, doc }) {
  const paddingMm = state?.card?.paddingMm ?? 0;
  const sizePt = state?.card?.font?.sizePt;
  const fontFamily = state?.card?.font?.family;
  const sizing = state?.layout?.cardSizing ?? "uniform";

  // Measure every token, tracking its (row, col) so placement can rebuild rows.
  const measured = [];
  doc.rows.forEach((tokens, row) => {
    tokens.forEach((token, col) => {
      const { widthMm, heightMm } = env.measureText(token, { sizePt, fontFamily });
      measured.push({
        token,
        row,
        col,
        textWidthMm: widthMm,
        textHeightMm: heightMm,
        innerWidthMm: widthMm + 2 * paddingMm,
        innerHeightMm: heightMm + 2 * paddingMm,
      });
    });
  });

  // Uniform: every card takes the widest and tallest footprint (aligned
  // columns). Height is always uniform, even when width mode is `fit`.
  const uniformHeight = measured.reduce((m, c) => Math.max(m, c.innerHeightMm), 0);
  const uniformWidth = measured.reduce((m, c) => Math.max(m, c.innerWidthMm), 0);

  const cards = measured.map((c) => ({
    ...c,
    innerWidthMm: sizing === "fit" ? c.innerWidthMm : uniformWidth,
    innerHeightMm: uniformHeight,
  }));

  return { state, env, doc: { ...doc, cards } };
}
