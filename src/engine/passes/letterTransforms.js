/**
 * Pass 4/6: letterTransforms
 *
 * Expands each placed card's token into per-glyph geometry, applying the
 * seeded playful letter style (random/wave/alternating/smile — SPEC.md user
 * stories 29–36). All randomness must derive deterministically from
 * `state.seed` + card/letter index (the "Seeded continuity" architectural
 * invariant) so "amount" sliders morph continuously and only `seed` reshuffles.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: CardWithGlyphs[] } }
 *   CardWithGlyphs: { ...PlacedCard, glyphs: Glyph[] }
 *   Glyph: { char, x, y, rotationDeg }
 *
 * Stub for issue #1: emits one glyph per character at (0, 0) with no
 * rotation — enough to satisfy the LayoutResult tree shape without any
 * product behaviour yet.
 */
export function letterTransforms({ state, env, doc }) {
  const cards = doc.cards.map((card) => ({
    ...card,
    glyphs: [...card.token].map((char) => ({ char, x: 0, y: 0, rotationDeg: 0 })),
  }));

  return { state, env, doc: { ...doc, cards } };
}
