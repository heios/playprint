// @ts-check
/** @import { PassContext } from '../types.js' */
import { letterParams, excursionGrowMm } from "../letterMotion.js";

/**
 * Pass 2/6: size
 *
 * Measures each token via `env.measureText`, then decides the shared card
 * footprint (SPEC.md user stories 10–15). Preserves row structure so `place`
 * can honour hard row breaks and empty rows.
 *
 * The inner border encloses the measured word plus `card.paddingMm` on every
 * side, AND grows by the worst-case playful-letter excursion (story 14) so no
 * rotated/offset glyph ever crosses the cut line — the grow amount is derived
 * from the very same `letterMotion` helper the `letterTransforms` pass uses to
 * place glyphs, so the box and the motion can never diverge. In `uniform`
 * sizing every card takes the widest such footprint, so columns align (the
 * "same space" invariant); in `fit` sizing each card hugs its own width but all
 * share the uniform height.
 *
 * Also assigns each card a stable `cardIndex` (row-major) so the seeded
 * playful transforms downstream key off a fixed per-card coordinate.
 *
 * Input:  { state, env, doc: { rows } }
 * Output: { state, env, doc: { rows, cards: SizedCard[] } }
 *   SizedCard: {
 *     token, row, col, cardIndex,
 *     textWidthMm, textHeightMm,   // measured glyph run
 *     innerWidthMm, innerHeightMm, // inner border box (text + padding + grow)
 *   }
 *
 * @param {PassContext} ctx
 * @returns {PassContext}
 */
export function size({ state, env, doc }) {
  const paddingMm = state?.card?.paddingMm ?? 0;
  const sizePt = state?.card?.font?.sizePt;
  const fontFamily = state?.card?.font?.family;
  const sizing = state?.layout?.cardSizing ?? "uniform";
  const params = letterParams(state?.letters);

  // Measure every token, tracking its (row, col) so placement can rebuild rows.
  const measured = [];
  let cardIndex = 0;
  doc.rows.forEach((tokens, row) => {
    tokens.forEach((token, col) => {
      const { widthMm, heightMm, ascentMm } = env.measureText(token, { sizePt, fontFamily });

      // Worst-case per-side grow so rotated/offset letters stay inside the cut
      // line (SPEC.md story 14). Bound the widest single glyph so the rotation
      // swing bound is tight but still containing.
      const maxCharWidthMm = [...token].reduce(
        (m, ch) => Math.max(m, env.measureText(ch, { sizePt, fontFamily }).widthMm),
        0,
      );
      const grow = excursionGrowMm(params, {
        maxCharWidthMm,
        ascentMm,
        descentMm: heightMm - ascentMm,
      });

      measured.push({
        token,
        row,
        col,
        cardIndex: cardIndex++,
        textWidthMm: widthMm,
        textHeightMm: heightMm,
        innerWidthMm: widthMm + 2 * paddingMm + 2 * grow.xMm,
        innerHeightMm: heightMm + 2 * paddingMm + 2 * grow.yMm,
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
