/**
 * Pass 6/6: paginate
 *
 * Slices the fully-laid-out cards into pages of the chosen paper size
 * (SPEC.md user stories 42–46), producing the final `LayoutResult` shape:
 * `{ pages: [{ cards: [{ outerRect, innerRect, glyphs }] }] }`.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: LayoutResult — the value `computeLayout` returns.
 *
 * Stub for issue #1: emits a single page holding every card (no overflow
 * splitting yet). Multi-page flow is a later slice's change to this pass
 * alone; the tree shape it must keep producing is fixed now.
 */
export function paginate({ doc }) {
  const cards = doc.cards.map(({ outerRect, innerRect, glyphs }) => ({ outerRect, innerRect, glyphs }));

  return { pages: [{ cards }] };
}
