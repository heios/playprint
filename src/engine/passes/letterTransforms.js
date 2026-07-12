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
 * glyph y is the run's top edge. Positions are absolute page-mm so the
 * renderer stays a thin pass-through. Per-glyph x comes from measuring string
 * prefixes through the same `env`, so preview and PDF agree exactly.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: CardWithGlyphs[] } }
 *   CardWithGlyphs: { ...PlacedCard, glyphs: Glyph[] }
 *   Glyph: { char, x, y, rotationDeg }
 */
export function letterTransforms({ state, env, doc }) {
  const sizePt = state?.card?.font?.sizePt;
  const fontFamily = state?.card?.font?.family;

  const cards = doc.cards.map((card) => {
    const chars = [...card.token];
    // Centre the measured text run horizontally and vertically in the cell.
    const runLeftMm = card.xMm + (card.widthMm - card.textWidthMm) / 2;
    const runTopMm = card.yMm + (card.heightMm - card.textHeightMm) / 2;

    let prefix = "";
    const glyphs = chars.map((char) => {
      const { widthMm: prefixWidthMm } = env.measureText(prefix, { sizePt, fontFamily });
      prefix += char;
      return { char, x: runLeftMm + prefixWidthMm, y: runTopMm, rotationDeg: 0 };
    });

    return { ...card, glyphs };
  });

  return { state, env, doc: { ...doc, cards } };
}
