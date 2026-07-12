import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

/**
 * Issue #3: playful letters + per-card tilt/shift, seeded & continuous.
 * Every assertion goes THROUGH computeLayout on the LayoutResult tree
 * (SPEC.md "Testing Decisions" — assert external engine behaviour).
 */
const env = createStubEnv({ charWidthMm: 5 });

function allCards(result) {
  return result.pages.flatMap((p) => p.cards);
}
function firstCard(result) {
  return allCards(result)[0];
}

describe("letter styles produce distinct per-glyph transforms", () => {
  it("random style: each letter gets an independent rotation and vertical offset", () => {
    const flat = firstCard(computeLayout(makeState({ text: "wobbly" }), env));
    const wild = firstCard(
      computeLayout(
        makeState({ text: "wobbly", letters: { style: "random", rotationDeg: 20, verticalMm: 6 } }),
        env,
      ),
    );

    // With amounts at 0 nothing rotates (baseline #2 behaviour preserved).
    expect(flat.glyphs.every((g) => g.rotationDeg === 0)).toBe(true);

    // With amounts up, rotations vary letter-to-letter (independent, not a single tilt).
    const rots = wild.glyphs.map((g) => g.rotationDeg);
    expect(new Set(rots.map((r) => r.toFixed(6))).size).toBeGreaterThan(1);
    // And letters have moved vertically off the shared baseline.
    const ys = wild.glyphs.map((g) => g.y);
    expect(new Set(ys.map((y) => y.toFixed(6))).size).toBeGreaterThan(1);
  });

  it("wave style: vertical offset follows a sine flow (a hump, not monotone)", () => {
    const card = firstCard(
      computeLayout(
        makeState({
          text: "abcdefgh",
          letters: { style: "wave", verticalMm: 8, rotationDeg: 0, waveFrequency: 1 },
        }),
        env,
      ),
    );
    const ys = card.glyphs.map((g) => g.y);
    // One cycle over the word: not strictly increasing nor decreasing (it turns).
    const strictlyMono = ys.every((y, i) => i === 0 || y > ys[i - 1]) || ys.every((y, i) => i === 0 || y < ys[i - 1]);
    expect(strictlyMono).toBe(false);
  });

  it("wave frequency changes the flow (progressive-disclosure control has effect)", () => {
    const low = firstCard(
      computeLayout(makeState({ text: "abcdefgh", letters: { style: "wave", verticalMm: 8, waveFrequency: 1 } }), env),
    );
    const high = firstCard(
      computeLayout(makeState({ text: "abcdefgh", letters: { style: "wave", verticalMm: 8, waveFrequency: 3 } }), env),
    );
    expect(low.glyphs.map((g) => g.y)).not.toEqual(high.glyphs.map((g) => g.y));
  });

  it("alternating style: letters zig-zag up/down in a tidy pattern", () => {
    const card = firstCard(
      computeLayout(makeState({ text: "abcd", letters: { style: "alternating", verticalMm: 5, rotationDeg: 10 } }), env),
    );
    const ys = card.glyphs.map((g) => g.y);
    // Even letters on one side, odd on the other: consecutive letters alternate.
    for (let i = 2; i < ys.length; i++) {
      expect(Math.sign(ys[i] - ys[i - 1])).toBe(-Math.sign(ys[i - 1] - ys[i - 2]));
    }
    // Rotation also alternates sign.
    const rots = card.glyphs.map((g) => g.rotationDeg);
    for (let i = 1; i < rots.length; i++) {
      expect(Math.sign(rots[i])).toBe(-Math.sign(rots[i - 1]));
    }
  });

  it("smile style: baseline curves symmetrically (ends differ from middle)", () => {
    const card = firstCard(
      computeLayout(makeState({ text: "abcdefg", letters: { style: "smile", verticalMm: 8 } }), env),
    );
    const ys = card.glyphs.map((g) => g.y);
    const mid = ys[Math.floor(ys.length / 2)];
    // Curved baseline: the middle sits off the line through the ends.
    expect(mid).not.toBeCloseTo((ys[0] + ys[ys.length - 1]) / 2, 3);
    // Symmetric: first and last letters share (nearly) the same offset.
    expect(ys[0]).toBeCloseTo(ys[ys.length - 1], 6);
  });
});

describe("sliders scale continuously (no re-roll)", () => {
  it("random rotation amount only scales fixed seeded directions", () => {
    const state = (amt) => makeState({ text: "abcdef", letters: { style: "random", rotationDeg: amt } });
    const a = firstCard(computeLayout(state(10), env)).glyphs.map((g) => g.rotationDeg);
    const b = firstCard(computeLayout(state(20), env)).glyphs.map((g) => g.rotationDeg);
    // Doubling the amount doubles every per-letter rotation (same directions scaled).
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i]) > 1e-9) expect(b[i] / a[i]).toBeCloseTo(2, 6);
    }
  });

  it("increasing an amount from zero grows every excursion monotonically (continuity)", () => {
    const at = (amt) =>
      firstCard(computeLayout(makeState({ text: "abcdef", letters: { style: "random", verticalMm: amt } }), env)).glyphs;
    const small = at(1);
    const big = at(4);
    const baseline = at(0);
    for (let i = 0; i < baseline.length; i++) {
      const dSmall = Math.abs(small[i].y - baseline[i].y);
      const dBig = Math.abs(big[i].y - baseline[i].y);
      expect(dBig).toBeGreaterThanOrEqual(dSmall - 1e-9);
    }
  });
});

describe("per-card tilt & shift", () => {
  it("tilts each card by a seeded amount scaled by card.rotationDeg", () => {
    const flat = allCards(computeLayout(makeState({ text: "a b c d" }), env));
    expect(flat.every((c) => (c.tiltDeg ?? 0) === 0)).toBe(true);

    const tilted = allCards(computeLayout(makeState({ text: "a b c d", card: { rotationDeg: 12 } }), env));
    const tilts = tilted.map((c) => c.tiltDeg);
    // Cards tilt, and not all by the same amount (seeded per card index).
    expect(tilts.some((t) => t !== 0)).toBe(true);
    expect(new Set(tilts.map((t) => t.toFixed(6))).size).toBeGreaterThan(1);
  });

  it("emits the tilt origin (inner-rect centre) so the renderer computes no geometry", () => {
    const cards = allCards(computeLayout(makeState({ text: "a b c d", card: { rotationDeg: 12, offsetMm: 5 } }), env));
    for (const c of cards) {
      // The engine owns the rotation centre; the renderer just reads it.
      expect(c.tiltOriginMm).toBeDefined();
      expect(c.tiltOriginMm.xMm).toBeCloseTo(c.innerRect.xMm + c.innerRect.widthMm / 2, 9);
      expect(c.tiltOriginMm.yMm).toBeCloseTo(c.innerRect.yMm + c.innerRect.heightMm / 2, 9);
    }
  });

  it("shifts each card by a seeded vector scaled by card.offsetMm", () => {
    const base = allCards(computeLayout(makeState({ text: "a b c d" }), env));
    const shifted = allCards(computeLayout(makeState({ text: "a b c d", card: { offsetMm: 5 } }), env));
    // At least one card's inner rect has moved from its un-shifted position.
    const moved = shifted.some((c, i) => c.innerRect.xMm !== base[i].innerRect.xMm || c.innerRect.yMm !== base[i].innerRect.yMm);
    expect(moved).toBe(true);
  });

  it("card shift scales linearly with the amount (continuous, seeded direction fixed)", () => {
    const shiftOf = (amt) => {
      const cards = allCards(computeLayout(makeState({ text: "a b c d", card: { offsetMm: amt } }), env));
      const base = allCards(computeLayout(makeState({ text: "a b c d" }), env));
      return cards.map((c, i) => ({ dx: c.innerRect.xMm - base[i].innerRect.xMm, dy: c.innerRect.yMm - base[i].innerRect.yMm }));
    };
    const a = shiftOf(2);
    const b = shiftOf(4);
    for (let i = 0; i < a.length; i++) {
      if (Math.hypot(a[i].dx, a[i].dy) > 1e-9) {
        expect(b[i].dx / a[i].dx).toBeCloseTo(2, 5);
        expect(b[i].dy / a[i].dy).toBeCloseTo(2, 5);
      }
    }
  });
});

describe("only seed / Randomize jumps", () => {
  it("changing seed may change everything; nothing else re-rolls", () => {
    const s = (seed) =>
      firstCard(computeLayout(makeState({ text: "abcdef", seed, letters: { style: "random", rotationDeg: 15, verticalMm: 5 } }), env));
    const rotsA = s(1).glyphs.map((g) => g.rotationDeg);
    const rotsB = s(2).glyphs.map((g) => g.rotationDeg);
    expect(rotsA).not.toEqual(rotsB);
  });
});
