// @ts-check
/** @import { PassContext } from '../types.js' */
import { seededUnitSigned, seededUnitVector } from "../seededTransform.js";

/**
 * Pass 7/8: scatter (Random layout mode only)
 *
 * Applies the clamp-to-cell scatter that makes the whole sheet read as a toy
 * (SPEC.md stories 39–40, "Layout modes: Random"). For every card that `place`
 * gave a large `cellMm` cell, this pass:
 *
 *   1. TILTS the card by up to `layout.random.rotationDeg`, seeded off the
 *      card's stable `cardIndex` — reusing the SAME seeded primitives as the
 *      per-card playful tilt from #3 (`seededUnitSigned`/`seededUnitVector`), so
 *      the scatter is continuous under amount changes and reshuffles only on a
 *      new seed.
 *   2. SHIFTS the card by up to `layout.random.shiftMm` along a seeded unit
 *      vector, but CLAMPS the shift so the card's (already-tilted) bounding box
 *      never leaves its cell. Because each cell is disjoint, a clamped card can
 *      never reach into a neighbour → no two cards overlap → every card stays
 *      cleanly cuttable.
 *
 * The tilt is emitted as `tiltDeg` about `tiltOriginMm` (the same render
 * contract `cardTransform` uses) and REPLACES any per-card playful tilt for
 * scattered cards, so the clamp bound stays exact. The shift is baked into the
 * card's rects + glyphs as a rigid translation (preserving cut-line
 * containment). In every other layout mode this pass is a pure passthrough.
 *
 * Runs AFTER `cardTransform` (rects/glyphs/tilt exist) and BEFORE `paginate`.
 * Pure function of `doc` + `state` + the seeded utility — no `env`.
 *
 * Input:  { state, env, doc: { rows, cards, page } }
 * Output: { state, env, doc: { rows, cards, page } }
 *
 * @param {PassContext} ctx
 * @returns {PassContext}
 */
export function scatter({ state, env, doc }) {
  if ((state?.layout?.mode ?? "grid") !== "random") {
    return { state, env, doc };
  }

  const seed = state?.seed ?? 0;
  const rotationAmountDeg = num(state?.layout?.random?.rotationDeg);
  const shiftAmountMm = num(state?.layout?.random?.shiftMm);

  const cards = doc.cards.map((card) => {
    const cell = card.cellMm;
    if (!cell) return card;

    // Seeded tilt (channel 0x5c keeps it independent of letter/mat draws).
    const tiltDeg = rotationAmountDeg * seededUnitSigned(seed, card.cardIndex, 0x5c);

    // The card's rotated bounding box half-extents about its own centre. Rects
    // were centred in the cell by `place`; a rigid tilt about that centre grows
    // the footprint to this box, which bounds how far the centre may still move
    // inside the cell.
    const rad = (Math.abs(tiltDeg) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const halfW = (card.widthMm * cos + card.heightMm * sin) / 2;
    const halfH = (card.widthMm * sin + card.heightMm * cos) / 2;

    // The rects were centred in the cell by `place`, so the free room the centre
    // may travel on each side before the rotated box hits a cell edge is simply
    // half the cell minus the box half-extent.
    const freeX = Math.max(0, cell.widthMm / 2 - halfW);
    const freeY = Math.max(0, cell.heightMm / 2 - halfH);

    // Seeded direction, then clamp its reach to the free room on each axis so
    // the box stays inside the cell. Scaling by the amount keeps motion
    // continuous; the clamp only caps it.
    const dir = seededUnitVector(seed, card.cardIndex, 0x5d);
    const dxMm = clamp(shiftAmountMm * dir.x, -freeX, freeX);
    const dyMm = clamp(shiftAmountMm * dir.y, -freeY, freeY);

    const innerRect = translateRect(card.innerRect, dxMm, dyMm);
    return {
      ...card,
      innerRect,
      outerRect: translateRect(card.outerRect, dxMm, dyMm),
      glyphs: card.glyphs.map((g) => ({ ...g, x: g.x + dxMm, y: g.y + dyMm })),
      tiltDeg,
      tiltOriginMm: { xMm: innerRect.xMm + innerRect.widthMm / 2, yMm: innerRect.yMm + innerRect.heightMm / 2 },
    };
  });

  return { state, env, doc: { ...doc, cards } };
}

function translateRect(rect, dxMm, dyMm) {
  return { ...rect, xMm: rect.xMm + dxMm, yMm: rect.yMm + dyMm };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
