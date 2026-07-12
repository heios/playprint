/**
 * Pass 3/6: place
 *
 * Assigns each sized card an (x, y) position on a page, per the active
 * layout mode (grid / flexible / random — SPEC.md user stories 37–41).
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: PlacedCard[] } }
 *   PlacedCard: { token, widthMm, heightMm, xMm, yMm }
 *
 * Stub for issue #1: places cards in a single naive left-to-right row at
 * origin. Grid/flexible/random layout modes are separate future slices that
 * replace this pass's body without touching its neighbours.
 */
export function place({ state, env, doc }) {
  let cursorMm = 0;
  const cards = doc.cards.map((card) => {
    const placed = { ...card, xMm: cursorMm, yMm: 0 };
    cursorMm += card.widthMm;
    return placed;
  });

  return { state, env, doc: { ...doc, cards } };
}
