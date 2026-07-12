/**
 * Pass 4/6: letterTransforms
 *
 * Expands each placed card's token into per-glyph geometry. Issue #2 lays the
 * text out flat and centred inside the card (no playful transforms yet): each
 * glyph gets an absolute (x, y) in mm and `rotationDeg: 0`. The seeded playful
 * styles (random/wave/alternating/smile — SPEC.md stories 29–36) are a later
 * slice that only adds per-glyph offsets/rotation on top of these base
 * positions, keeping the "seeded continuity" invariant.
 *
 * Glyph x is the left edge of that character within the centred text run;
 * glyph y is the text baseline — render-ready, so the SVG/PDF renderers draw
 * `<text y={glyph.y}>` with NO vertical offset of their own (SPEC.md: "preview
 * and PDF share the same metrics and match exactly"; the renderers are thin
 * passes over this mm-tree). The baseline is the run's top edge dropped by the
 * env-measured `ascentMm`, using the same measured run height the engine
 * centres by — so the horizontal/vertical metrics never diverge.
 *
 * Positions are absolute page-mm. Per-glyph x and the ascent both come from the
 * same `env`, so preview and PDF agree exactly.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: CardWithGlyphs[] } }
 *   CardWithGlyphs: { ...PlacedCard, glyphs: Glyph[] }
 *   Glyph: { char, x, y, rotationDeg }  // y is the baseline
 */
export function letterTransforms({ state, env, doc }) {
  const sizePt = state?.card?.font?.sizePt;
  const fontFamily = state?.card?.font?.family;

  const cards = doc.cards.map((card) => {
    const chars = [...card.token];
    // Measure the whole run once for its ascent (top edge → baseline). Reusing
    // the same measurement the engine centres by keeps the vertical metric
    // consistent with `textHeightMm`.
    const { ascentMm } = env.measureText(card.token, { sizePt, fontFamily });

    // Centre the measured text run horizontally and vertically in the cell, then
    // drop from the run's top edge to the baseline by the measured ascent.
    const runLeftMm = card.xMm + (card.widthMm - card.textWidthMm) / 2;
    const runTopMm = card.yMm + (card.heightMm - card.textHeightMm) / 2;
    const baselineMm = runTopMm + ascentMm;

    let prefix = "";
    const glyphs = chars.map((char) => {
      const { widthMm: prefixWidthMm } = env.measureText(prefix, { sizePt, fontFamily });
      prefix += char;
      return { char, x: runLeftMm + prefixWidthMm, y: baselineMm, rotationDeg: 0 };
    });

    return { ...card, glyphs };
  });

  return { state, env, doc: { ...doc, cards } };
}
