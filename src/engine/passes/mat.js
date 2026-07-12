import { seededUnitVector } from "../seededTransform.js";

/**
 * Pass 5/7: mat
 *
 * Builds the inner and outer (mat) border rectangles around each card,
 * enforcing the nesting invariant Text ⊂ Inner border ⊂ Outer border ⊂ Cell
 * (SPEC.md user stories 16–28) and carrying each border's styling + per-pass
 * visibility onto the card so the renderer stays thin.
 *
 * With the mat DISABLED (`state.card.outer.enabled` false — the default), the
 * `outerRect` simply mirrors `innerRect`: no mat, no float, so the #2/#3
 * baseline is unchanged. When ENABLED, the outer border grows OUTWARD around
 * the placed inner cell by a mat margin derived from `matPercent`, and the
 * inner card FLOATS inside it along a seeded direction (SPEC.md stories 23–26,
 * "Mat float clamping"):
 *
 *   - Mat margin `m` = `matPercent%` of the inner card's mean size. The outer
 *     starts centred, `m` on every side, then the inner shifts within it.
 *   - The shift is `t · m · seededUnitVector(seed, cardIndex)` — a FIXED seeded
 *     direction scaled by a per-card magnitude `t ∈ [0, 1]` found by a monotonic
 *     bisection search: the LARGEST `t` whose resulting geometry still satisfies
 *     BOTH the minimum-clearance floor (no side gap below `minClearanceMm`) and
 *     the corner balance (`max(cornerGap) ≤ balanceRatio · min(cornerGap)`).
 *     Both constraints degrade monotonically with `t` (they hold at `t = 0`,
 *     the centred case), so bisection converges and the motion is continuous:
 *     loosen `balanceRatio` → the inner drifts further; tighten `minClearanceMm`
 *     → it pulls back toward centre; no popping.
 *
 * Corner clearance = distance from each inner corner to the nearest point of
 * the outer boundary = the smaller of the two side gaps meeting at that corner
 * (nested axis-aligned rects).
 *
 * Runs BEFORE `cardTransform` (which then rigidly shifts/tilts the whole card —
 * both rects and glyphs — as one body, preserving this nesting).
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: MattedCard[] } }
 *   MattedCard: { ...CardWithGlyphs, innerRect, outerRect, inner, outer, textVisible }
 *   Rect: { xMm, yMm, widthMm, heightMm }
 */
export function mat({ state, env, doc }) {
  const innerSrc = state?.card?.inner ?? {};
  const outerSrc = state?.card?.outer ?? {};
  const vis = state?.visibility ?? {};
  const seed = state?.seed ?? 0;

  const enabled = outerSrc.enabled === true;
  const matPercent = Math.max(0, num(outerSrc.matPercent, 25));
  const minClearanceMm = Math.max(0, num(outerSrc.minClearanceMm, 0));
  const balanceRatio = Math.max(1, num(outerSrc.balanceRatio, 2));

  // Story 27: the border on/off toggle (inner.visible) AND the per-pass layer
  // toggle (visibility.inner) are independent switches — either hides the inner.
  const inner = {
    color: innerSrc.color ?? "#000000",
    strokeMm: num(innerSrc.strokeMm, 0.5),
    radiusMm: num(innerSrc.radiusMm, 0),
    visible: innerSrc.visible !== false && vis.inner !== false,
  };

  const outer = {
    enabled,
    color: outerSrc.color ?? "#000000",
    strokeMm: num(outerSrc.strokeMm, 0.5),
    radiusMm: num(outerSrc.radiusMm, 0),
    // The mat layer only shows when it exists (enabled) and its pass is on.
    visible: enabled && vis.outer !== false,
  };

  const textVisible = vis.text !== false;

  const cards = doc.cards.map((card) => {
    const innerBase = { xMm: card.xMm, yMm: card.yMm, widthMm: card.widthMm, heightMm: card.heightMm };

    if (!enabled) {
      return { ...card, innerRect: innerBase, outerRect: { ...innerBase }, inner, outer, textVisible };
    }

    // Mat margin from the inner card's mean size, so the mat scales with the card.
    const m = (matPercent / 100) * ((innerBase.widthMm + innerBase.heightMm) / 2);
    const dir = seededUnitVector(seed, card.cardIndex, 0x4a7);

    // Largest float magnitude satisfying both constraints, via monotonic search.
    const t = clampFloatMagnitude(m, dir, minClearanceMm, balanceRatio);
    const sx = t * m * dir.x;
    const sy = t * m * dir.y;

    // Outer stays fixed (inner-nominal grown by `m` each side); the inner floats
    // by (sx, sy) inside it.
    const outerRect = {
      xMm: innerBase.xMm - m,
      yMm: innerBase.yMm - m,
      widthMm: innerBase.widthMm + 2 * m,
      heightMm: innerBase.heightMm + 2 * m,
    };
    const innerRect = { ...innerBase, xMm: innerBase.xMm + sx, yMm: innerBase.yMm + sy };

    return { ...card, innerRect, outerRect, inner, outer, textVisible };
  });

  return { state, env, doc: { ...doc, cards } };
}

/**
 * Find the largest float magnitude `t ∈ [0, 1]` along `dir` (scaled by mat
 * margin `m`) whose per-side gaps and corner clearances satisfy both the
 * minimum-clearance floor and the balance ratio. Both predicates hold at
 * `t = 0` (centred) and fail monotonically as `t` grows, so bisection on the
 * boundary is exact and continuous.
 */
function clampFloatMagnitude(m, dir, minClearanceMm, balanceRatio) {
  if (m <= 0) return 0;
  // If even the fully-centred mat is thinner than the required clearance, there
  // is no admissible float — pin to centre (t = 0) so the floor still holds as
  // closely as the geometry allows.
  if (m + 1e-9 < minClearanceMm) return 0;
  if (satisfies(1, m, dir, minClearanceMm, balanceRatio)) return 1;

  let lo = 0; // known-good
  let hi = 1; // known-bad
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (satisfies(mid, m, dir, minClearanceMm, balanceRatio)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Do the gaps for float magnitude `t` satisfy clearance AND balance? */
function satisfies(t, m, dir, minClearanceMm, balanceRatio) {
  const sx = t * m * dir.x;
  const sy = t * m * dir.y;
  // Per-side gaps (outer centred, inner shifted by (sx, sy)).
  const left = m + sx;
  const right = m - sx;
  const top = m + sy;
  const bottom = m - sy;

  // Minimum-clearance floor on every side.
  if (Math.min(left, right, top, bottom) < minClearanceMm - 1e-9) return false;

  // Corner balance: 4 corner clearances = min of the two meeting side gaps.
  const corners = [Math.min(left, top), Math.min(right, top), Math.min(left, bottom), Math.min(right, bottom)];
  const max = Math.max(...corners);
  const min = Math.min(...corners);
  return max <= balanceRatio * min + 1e-9;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
