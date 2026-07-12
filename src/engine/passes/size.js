/**
 * Pass 2/6: size
 *
 * Measures each token via `env.measureText` and decides each card's cell
 * footprint (uniform vs fit sizing — SPEC.md user stories 10–15).
 *
 * Input:  { state, env, doc: { rows } }
 * Output: { state, env, doc: { rows, cards: Card[] } }
 *   Card (intermediate, pre-placement): { token, widthMm, heightMm }
 *
 * Stub for issue #1: measures tokens but does not yet apply uniform/fit
 * sizing-mode rules or padding/auto-grow. Later slices extend this pass in
 * place — the module boundary (measure in, sized cards out) does not change.
 */
export function size({ state, env, doc }) {
  const cards = doc.rows.flat().map((token) => {
    const { widthMm, heightMm } = env.measureText(token, { sizePt: state?.card?.font?.sizePt });
    return { token, widthMm, heightMm };
  });

  return { state, env, doc: { ...doc, cards } };
}
