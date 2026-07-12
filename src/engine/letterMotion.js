import { seededUnitSigned } from "./seededTransform.js";

/**
 * The single source of truth for playful LETTER motion (SPEC.md stories
 * 29–33, 35): given a style + amounts + seed, it produces each glyph's
 * `{ dxMm, dyMm, rotationDeg }` offset from its flat centred position, AND the
 * worst-case per-side excursion the inner border must grow by so no rotated
 * glyph crosses the cut line (story 14).
 *
 * Both the `size` pass (which grows the uniform footprint up front) and the
 * `letterTransforms` pass (which places the glyphs) call in here, so the grown
 * box and the actual motion can never diverge — containment holds by
 * construction for ANY amounts.
 *
 * This is a plain pure helper, not a pipeline pass (no `doc`/`env` threading).
 * All randomness comes through `seededUnitSigned(seed, cardIndex, letterIndex,
 * channel)`, so every amount only SCALES a fixed seeded direction — increasing
 * it moves letters continuously, and only a new `seed` reshuffles.
 */

// Distinct hash channels so a letter's rotation, vertical and horizontal draws
// are independent (they must not move in lockstep).
const CH_ROT = 1;
const CH_VERT = 2;
const CH_HORIZ = 3;

/** Normalise the `state.letters` slice to concrete numbers. */
export function letterParams(letters = {}) {
  return {
    style: letters.style ?? "random",
    rotationDeg: num(letters.rotationDeg),
    verticalMm: num(letters.verticalMm),
    horizontalJitterMm: num(letters.horizontalJitterMm),
    waveFrequency: letters.waveFrequency ?? 1,
  };
}

/**
 * The offset for one glyph. `{ dxMm, dyMm, rotationDeg }` are ADDED to the flat
 * centred glyph position and rotation.
 *
 * @param {object} params result of `letterParams`
 * @param {number} seed
 * @param {number} cardIndex
 * @param {number} i letter index within the word
 * @param {number} n letter count of the word
 */
export function glyphOffset(params, seed, cardIndex, i, n) {
  const { style, rotationDeg, verticalMm, horizontalJitterMm, waveFrequency } = params;

  if (style === "wave") {
    // Sine flow along the word; frequency = cycles per word. Rotation follows
    // the curve's slope (cosine) for a flowing tilt.
    const phase = n > 1 ? (i / (n - 1)) * waveFrequency * Math.PI * 2 : 0;
    return { dxMm: 0, dyMm: verticalMm * Math.sin(phase), rotationDeg: rotationDeg * Math.cos(phase) };
  }

  if (style === "alternating") {
    // Tidy zig-zag: even letters one way, odd the other.
    const s = i % 2 === 0 ? 1 : -1;
    return { dxMm: 0, dyMm: verticalMm * s, rotationDeg: rotationDeg * s };
  }

  if (style === "smile") {
    // Letters ride a gentle curved baseline (a U): ends high, middle low.
    // t ∈ [-1, 1] across the word; dy = vertical * (1 - t²) dips the middle,
    // rotation follows the slope (∝ -t) so letters lean into the curve.
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
    return { dxMm: 0, dyMm: verticalMm * (1 - t * t), rotationDeg: rotationDeg * -t };
  }

  // "random": independent seeded rotation + offset per letter, each amount
  // scaling a fixed unit direction (continuous; reseed reshuffles).
  return {
    dxMm: horizontalJitterMm * seededUnitSigned(seed, cardIndex, i, CH_HORIZ),
    dyMm: verticalMm * seededUnitSigned(seed, cardIndex, i, CH_VERT),
    rotationDeg: rotationDeg * seededUnitSigned(seed, cardIndex, i, CH_ROT),
  };
}

/**
 * Worst-case per-side growth (mm) the inner border needs so that, for ANY
 * seeded direction, a glyph shifted up to (dxMax, dyMax) and rotated up to
 * `rotationDeg` never crosses the cut line. Applied symmetrically on all four
 * sides, so the flat centred run keeps its `paddingMm` clearance even at the
 * worst amounts.
 *
 * Rotation swing: a glyph-box corner at distance `r` from the glyph's
 * baseline-left rotation origin moves at most `2·r·sin(α/2)` under rotation α.
 * `r` is bounded by the glyph box diagonal from that origin.
 *
 * @param {object} params result of `letterParams`
 * @param {{ maxCharWidthMm: number, ascentMm: number, descentMm: number }} metrics
 * @returns {{ xMm: number, yMm: number }} growth to add on EACH side.
 */
export function excursionGrowMm(params, { maxCharWidthMm, ascentMm, descentMm }) {
  const { rotationDeg, verticalMm, horizontalJitterMm, style } = params;
  const rMax = Math.hypot(maxCharWidthMm, Math.max(ascentMm, descentMm));
  const swing = 2 * rMax * Math.sin(Math.abs(rotationDeg) * (Math.PI / 180) / 2);
  // Horizontal jitter only exists in the random style.
  const dxMax = style === "random" ? Math.abs(horizontalJitterMm) : 0;
  const dyMax = Math.abs(verticalMm);
  return { xMm: dxMax + swing, yMm: dyMax + swing };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
