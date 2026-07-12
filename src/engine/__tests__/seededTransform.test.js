import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { seededUnitSigned, seededUnitPositive } from "../seededTransform.js";

/**
 * The shared seeded-transform utility (SPEC.md "Seeded continuity"): a pure
 * hash of (seed, ...indices) → a FIXED direction/phase. Issue #3 introduces it;
 * #4 (mat float) and #5 (Random scatter) reuse it, so it is tested directly as
 * its own seam — deterministic, in-range, and well-distributed across indices.
 */
describe("seededUnitSigned", () => {
  it("is deterministic for the same seed + indices", () => {
    expect(seededUnitSigned(7, 3, 2)).toBe(seededUnitSigned(7, 3, 2));
  });

  it("returns a value in [-1, 1] for arbitrary integer inputs", () => {
    fc.assert(
      fc.property(fc.integer(), fc.nat(), fc.nat(), (seed, a, b) => {
        const v = seededUnitSigned(seed, a, b);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("does NOT depend on the argument count vs. distinct indices: different indices generally differ", () => {
    // A fixed seed should map neighbouring letter indices to different directions
    // (otherwise all letters would move identically). Check a handful differ.
    const values = [0, 1, 2, 3, 4, 5].map((i) => seededUnitSigned(42, 0, i));
    expect(new Set(values.map((v) => v.toFixed(6))).size).toBeGreaterThan(1);
  });

  it("changing the seed generally changes the direction (reshuffle)", () => {
    const a = seededUnitSigned(1, 0, 0);
    const b = seededUnitSigned(2, 0, 0);
    expect(a).not.toBe(b);
  });
});

describe("seededUnitPositive", () => {
  it("returns a value in [0, 1] for arbitrary inputs", () => {
    fc.assert(
      fc.property(fc.integer(), fc.nat(), (seed, a) => {
        const v = seededUnitPositive(seed, a);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("is deterministic", () => {
    expect(seededUnitPositive(9, 5)).toBe(seededUnitPositive(9, 5));
  });
});
