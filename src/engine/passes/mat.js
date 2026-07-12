/**
 * Pass 5/6: mat
 *
 * Builds the inner/outer border rectangles around each card (the two-layer
 * matted-craft look — SPEC.md user stories 16–28), enforcing the nesting
 * invariant Text ⊂ Inner border ⊂ Outer border ⊂ Cell, minimum clearance, and
 * the corner-balance ratio for the outer mat's seeded float.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: MattedCard[] } }
 *   MattedCard: { ...CardWithGlyphs, outerRect, innerRect }
 *   Rect: { xMm, yMm, widthMm, heightMm }
 *
 * Stub for issue #1: derives a single innerRect tightly around the card's
 * measured footprint and mirrors it as outerRect (mat disabled). Real
 * padding/auto-grow/mat-clamping logic is a later slice's change to this
 * pass alone.
 */
export function mat({ state, env, doc }) {
  const cards = doc.cards.map((card) => {
    const innerRect = { xMm: card.xMm, yMm: card.yMm, widthMm: card.widthMm, heightMm: card.heightMm };
    const outerRect = { ...innerRect };
    return { ...card, innerRect, outerRect };
  });

  return { state, env, doc: { ...doc, cards } };
}
