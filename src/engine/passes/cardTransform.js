import { seededUnitSigned, seededUnitVector } from "../seededTransform.js";

/**
 * Pass 6/7: cardTransform
 *
 * Adds per-card playful tilt + shift so the cards themselves look scattered
 * like a toy (SPEC.md stories 34–36). Both are seeded off the card's stable
 * `cardIndex`, and each amount only SCALES a fixed seeded direction, so
 * dragging a slider morphs the sheet continuously and only a new `seed`
 * reshuffles.
 *
 *   - SHIFT: the whole card (its inner/outer rects AND every glyph) is
 *     translated by `card.offsetMm · seededUnitVector(seed, cardIndex)`. Moving
 *     the geometry as one rigid body preserves the cut-line containment the
 *     `size`/`letterTransforms` passes established.
 *   - TILT: emitted as `tiltDeg` on the card (not baked into coordinates), for
 *     the renderer to apply as a group rotation about the card centre. Rotating
 *     the whole card group keeps glyphs inside their border, so containment
 *     still holds under any tilt.
 *
 * Runs AFTER `mat` (so both rects exist to translate) and BEFORE `paginate`
 * (which trims the card to the render contract, now including `tiltDeg`). It is
 * a pure function of `doc` + `state` + the seeded utility — no `env`.
 *
 * Input:  { state, env, doc: { rows, cards, page } }
 * Output: { state, env, doc: { rows, cards: TransformedCard[], page } }
 *   TransformedCard: { ...MattedCard, tiltDeg }
 */
export function cardTransform({ state, env, doc }) {
  const seed = state?.seed ?? 0;
  const offsetMm = num(state?.card?.offsetMm);
  const tiltAmountDeg = num(state?.card?.rotationDeg);

  const cards = doc.cards.map((card) => {
    const dir = seededUnitVector(seed, card.cardIndex);
    const dxMm = offsetMm * dir.x;
    const dyMm = offsetMm * dir.y;
    const tiltDeg = tiltAmountDeg * seededUnitSigned(seed, card.cardIndex, 0x71);

    return {
      ...card,
      innerRect: translateRect(card.innerRect, dxMm, dyMm),
      outerRect: translateRect(card.outerRect, dxMm, dyMm),
      glyphs: card.glyphs.map((g) => ({ ...g, x: g.x + dxMm, y: g.y + dyMm })),
      tiltDeg,
    };
  });

  return { state, env, doc: { ...doc, cards } };
}

function translateRect(rect, dxMm, dyMm) {
  return { ...rect, xMm: rect.xMm + dxMm, yMm: rect.yMm + dyMm };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
