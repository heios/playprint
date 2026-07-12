/**
 * Pass 5/6: mat
 *
 * Builds the inner (and, later, outer) border rectangles around each card,
 * enforcing the nesting invariant Text ⊂ Inner border ⊂ Outer border ⊂ Cell
 * (SPEC.md user stories 16–28) and carrying the border's styling onto the
 * card so the renderer stays thin.
 *
 * Issue #2 ships the inner border only: `innerRect` is the placed uniform cell
 * (text + padding), and its style — colour, stroke width (mm), corner radius,
 * and an on/off `visible` flag (story 19) — is copied from `state.card.inner`.
 * With the mat disabled the `outerRect` simply mirrors `innerRect`; the seeded
 * float, minimum clearance and corner-balance logic land in a later slice that
 * only extends this pass.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: MattedCard[] } }
 *   MattedCard: { ...CardWithGlyphs, outerRect, innerRect, inner }
 *   Rect: { xMm, yMm, widthMm, heightMm }
 */
export function mat({ state, env, doc }) {
  const src = state?.card?.inner ?? {};
  const inner = {
    color: src.color ?? "#000000",
    strokeMm: src.strokeMm ?? 0.5,
    radiusMm: src.radiusMm ?? 0,
    visible: src.visible !== false,
  };

  const cards = doc.cards.map((card) => {
    const innerRect = { xMm: card.xMm, yMm: card.yMm, widthMm: card.widthMm, heightMm: card.heightMm };
    const outerRect = { ...innerRect };
    return { ...card, innerRect, outerRect, inner };
  });

  return { state, env, doc: { ...doc, cards } };
}
