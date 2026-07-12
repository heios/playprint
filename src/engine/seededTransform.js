/**
 * Shared seeded-transform utility — the deterministic randomness source for
 * ALL playful motion (SPEC.md "Seeded continuity (architectural invariant)").
 *
 * A pure integer hash of `(seed, ...indices)` yields a FIXED unit
 * direction/phase for that (seed, card, letter) coordinate. Callers scale that
 * fixed direction by an "amount" parameter, so increasing the amount moves
 * things continuously outward and NEVER re-rolls — only changing `seed`
 * (Randomize) reshuffles the directions.
 *
 * This module is a plain helper, NOT a pipeline pass: it holds no `doc` state
 * and never touches `env`. Issue #3 introduces it for playful letters and
 * per-card tilt/shift; issues #4 (mat float) and #5 (Random scatter) reuse the
 * same hash so their motion is continuous and reproducible too.
 *
 * Kept DOM-free and side-effect-free so the engine stays pure and testable.
 */

/**
 * A 32-bit integer avalanche hash (MurmurHash3 finalizer style) over a list of
 * integer inputs. Deterministic and well-mixed: small changes in any input
 * change the whole output, so neighbouring letter indices map to unrelated
 * directions.
 *
 * @param {...number} ints integer inputs (seed + indices); coerced to int32.
 * @returns {number} an unsigned 32-bit integer.
 */
export function hash32(...ints) {
  let h = 0x811c9dc5 | 0; // FNV-ish offset, then Murmur mixing per input
  for (let n of ints) {
    n = n | 0;
    // Mix each input word through the Murmur3 finalizer.
    let k = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    k = Math.imul(k ^ (k >>> 16), 0x45d9f3b);
    k = k ^ (k >>> 16);
    h ^= k;
    h = (h << 13) | (h >>> 19); // rotate
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  // Final avalanche.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A deterministic value in `[0, 1]` for the given coordinate.
 * @param {...number} ints seed + indices.
 * @returns {number}
 */
export function seededUnitPositive(...ints) {
  return hash32(...ints) / 0xffffffff;
}

/**
 * A deterministic value in `[-1, 1]` — a fixed signed "direction" for the given
 * coordinate. This is the primitive callers scale by an amount.
 * @param {...number} ints seed + indices.
 * @returns {number}
 */
export function seededUnitSigned(...ints) {
  return seededUnitPositive(...ints) * 2 - 1;
}

/**
 * A fixed seeded unit vector (a direction on the unit circle) for the given
 * coordinate — used for 2-D drift (per-card shift, mat float, scatter).
 * @param {...number} ints seed + indices.
 * @returns {{ x: number, y: number }} a point on the unit circle.
 */
export function seededUnitVector(...ints) {
  // Derive a distinct angle by hashing with an extra channel offset so the
  // vector's angle is independent of any 1-D value drawn from the same coord.
  const angle = seededUnitPositive(...ints, 0x2d) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
