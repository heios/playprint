// @ts-check
/** @import { PassContext } from '../types.js' */
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
 *   - TILT: emitted as `tiltDeg` plus its rotation origin `tiltOriginMm` (the
 *     shifted inner-rect centre) on the card (not baked into coordinates), for
 *     the renderer to apply as a group rotation about that point. The engine
 *     owns this containment-critical centre so the thin renderer reads it
 *     rather than re-deriving it. Rotating the whole card group about its own
 *     centre keeps glyphs inside their border, so containment holds under any
 *     tilt.
 *
 * Runs AFTER `mat` (so both rects exist to translate) and BEFORE `paginate`
 * (which trims the card to the render contract, now including `tiltDeg`). It is
 * a pure function of `doc` + `state` + the seeded utility — no `env`.
 *
 * Input:  { state, env, doc: { rows, cards, page } }
 * Output: { state, env, doc: { rows, cards: TransformedCard[], page } }
 *   TransformedCard: { ...MattedCard, tiltDeg, tiltOriginMm: { xMm, yMm } }
 *
 * @param {PassContext} ctx
 * @returns {PassContext}
 */
export function cardTransform({ state, env, doc }) {
  const seed = state?.seed ?? 0;
  // In Random layout mode the dedicated `scatter` pass owns per-card tilt/shift
  // (clamp-to-cell), so this per-card playful drift stands down to keep the
  // clamp bound exact (the card must stay centred in its cell for `scatter`).
  const isRandom = (state?.layout?.mode ?? "grid") === "random";
  const offsetMm = isRandom ? 0 : num(state?.card?.offsetMm);
  const tiltAmountDeg = isRandom ? 0 : num(state?.card?.rotationDeg);

  const cards = doc.cards.map((card) => {
    const dir = seededUnitVector(seed, card.cardIndex);
    const dxMm = offsetMm * dir.x;
    const dyMm = offsetMm * dir.y;
    const tiltDeg = tiltAmountDeg * seededUnitSigned(seed, card.cardIndex, 0x71);

    const innerRect = translateRect(card.innerRect, dxMm, dyMm);

    return {
      ...card,
      innerRect,
      outerRect: translateRect(card.outerRect, dxMm, dyMm),
      glyphs: card.glyphs.map((g) => ({ ...g, x: g.x + dxMm, y: g.y + dyMm })),
      tiltDeg,
      tiltOriginMm: rectCentre(innerRect),
    };
  });

  return { state, env, doc: { ...doc, cards } };
}

function rectCentre(rect) {
  return { xMm: rect.xMm + rect.widthMm / 2, yMm: rect.yMm + rect.heightMm / 2 };
}

function translateRect(rect, dxMm, dyMm) {
  return { ...rect, xMm: rect.xMm + dxMm, yMm: rect.yMm + dyMm };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
