import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

/**
 * Issue #4: the second border (mat) with clamped float & layer toggles
 * (SPEC.md user stories 20–28 + "Mat float clamping"). Every assertion goes
 * THROUGH computeLayout on the LayoutResult tree — the mat geometry the engine
 * produces and the invariants it guarantees, never the renderer/DOM.
 */

const env = createStubEnv({ charWidthMm: 5 });

function allCards(result) {
  return result.pages.flatMap((p) => p.cards);
}

/** A state with the mat enabled, merged over the shipped defaults. */
function matState(overrides = {}) {
  return makeState({
    text: "January February March",
    seed: 7,
    ...overrides,
    card: {
      ...(overrides.card ?? {}),
      outer: { enabled: true, matPercent: 25, minClearanceMm: 2, balanceRatio: 2, ...(overrides.card?.outer ?? {}) },
    },
  });
}

/** The four per-side gaps between an inner rect and the outer rect around it. */
function sideGaps(card) {
  const i = card.innerRect;
  const o = card.outerRect;
  return {
    left: i.xMm - o.xMm,
    right: o.xMm + o.widthMm - (i.xMm + i.widthMm),
    top: i.yMm - o.yMm,
    bottom: o.yMm + o.heightMm - (i.yMm + i.heightMm),
  };
}

/**
 * Corner clearance = distance from each inner corner to the nearest point of
 * the outer boundary. For nested axis-aligned rects that is the smaller of the
 * two side gaps meeting at the corner (SPEC.md "Mat float clamping").
 */
function cornerClearances(card) {
  const g = sideGaps(card);
  return [
    Math.min(g.left, g.top),
    Math.min(g.right, g.top),
    Math.min(g.left, g.bottom),
    Math.min(g.right, g.bottom),
  ];
}

describe("mat: enabled vs disabled", () => {
  it("disabled by default — the outer border mirrors the inner and no float happens", () => {
    const [card] = allCards(computeLayout(makeState({ text: "hi" }), env));
    expect(card.outerRect).toEqual(card.innerRect);
    expect(card.outer?.enabled ?? false).toBe(false);
  });

  it("enabled — the outer border is strictly larger than the inner and surrounds it", () => {
    const [card] = allCards(computeLayout(matState({ text: "hi" }), env));
    const g = sideGaps(card);
    expect(g.left).toBeGreaterThan(0);
    expect(g.right).toBeGreaterThan(0);
    expect(g.top).toBeGreaterThan(0);
    expect(g.bottom).toBeGreaterThan(0);
    expect(card.outerRect.widthMm).toBeGreaterThan(card.innerRect.widthMm);
    expect(card.outerRect.heightMm).toBeGreaterThan(card.innerRect.heightMm);
  });

  it("carries the outer border's own colour, stroke and radius onto each card", () => {
    const state = matState({
      text: "x",
      card: { outer: { color: "#00aa88", strokeMm: 1.25, radiusMm: 4 } },
    });
    const [card] = allCards(computeLayout(state, env));
    expect(card.outer).toMatchObject({ enabled: true, color: "#00aa88", strokeMm: 1.25, radiusMm: 4 });
  });

  it("mat amount sets the relative inner→outer size (bigger amount ⇒ bigger mat)", () => {
    const small = allCards(computeLayout(matState({ text: "hello", card: { outer: { matPercent: 10 } } }), env))[0];
    const big = allCards(computeLayout(matState({ text: "hello", card: { outer: { matPercent: 40 } } }), env))[0];
    expect(big.outerRect.widthMm).toBeGreaterThan(small.outerRect.widthMm);
    expect(big.outerRect.heightMm).toBeGreaterThan(small.outerRect.heightMm);
  });
});

describe("mat: the inner floats (not rigidly centred)", () => {
  it("at least one card's inner is off-centre inside its mat", () => {
    const cards = allCards(computeLayout(matState({ text: "one two three four" }), env));
    const anyOffCentre = cards.some((card) => {
      const g = sideGaps(card);
      return Math.abs(g.left - g.right) > 1e-6 || Math.abs(g.top - g.bottom) > 1e-6;
    });
    expect(anyOffCentre).toBe(true);
  });
});

describe("mat invariants: minimum clearance", () => {
  it("the inner never comes closer than minClearanceMm to the outer on ANY side", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        fc.double({ min: 0, max: 8, noNaN: true }),
        fc.double({ min: 5, max: 60, noNaN: true }),
        (seed, minClearanceMm, matPercent) => {
          const state = matState({
            text: "January February March April May",
            seed,
            card: { outer: { minClearanceMm, matPercent, balanceRatio: 3 } },
          });
          for (const card of allCards(computeLayout(state, env))) {
            // Nominal mat margin (outer is fixed, so half the width difference).
            const nominalMarginMm = (card.outerRect.widthMm - card.innerRect.widthMm) / 2;
            // The floor is only geometrically achievable when the mat is at least
            // as wide as the requested clearance; a mat thinner than the clearance
            // is an infeasible ask, and the engine best-efforts by staying centred.
            if (nominalMarginMm + 1e-9 < minClearanceMm) continue;
            const g = sideGaps(card);
            for (const side of [g.left, g.right, g.top, g.bottom]) {
              expect(side).toBeGreaterThanOrEqual(minClearanceMm - 1e-6);
            }
          }
        },
      ),
    );
  });
});

describe("mat invariants: corner balance", () => {
  it("the 4 corner clearances satisfy max < balanceRatio · min", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        fc.double({ min: 1.2, max: 4, noNaN: true }),
        fc.double({ min: 10, max: 50, noNaN: true }),
        (seed, balanceRatio, matPercent) => {
          const state = matState({
            text: "January February March April",
            seed,
            card: { outer: { balanceRatio, matPercent, minClearanceMm: 1 } },
          });
          for (const card of allCards(computeLayout(state, env))) {
            const cc = cornerClearances(card);
            const max = Math.max(...cc);
            const min = Math.min(...cc);
            expect(max).toBeLessThanOrEqual(balanceRatio * min + 1e-6);
          }
        },
      ),
    );
  });
});

describe("mat: float clamping is monotone/continuous", () => {
  it("loosening the balance ratio never pulls the inner toward centre (drifts further, no popping)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (seed) => {
        const magnitudes = (k) =>
          allCards(computeLayout(matState({ text: "one two three four", seed, card: { outer: { balanceRatio: k } } }), env)).map(
            (card) => {
              const g = sideGaps(card);
              // Signed float from centre on each axis; magnitude is its length.
              const fx = (g.left - g.right) / 2;
              const fy = (g.top - g.bottom) / 2;
              return Math.hypot(fx, fy);
            },
          );
        const tight = magnitudes(1.5);
        const loose = magnitudes(3);
        for (let i = 0; i < tight.length; i++) {
          expect(loose[i]).toBeGreaterThanOrEqual(tight[i] - 1e-6);
        }
      }),
    );
  });

  it("a tiny change in mat amount yields a tiny change in the inner's float (continuity)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (seed) => {
        const floats = (matPercent) =>
          allCards(computeLayout(matState({ text: "one two three four", seed, card: { outer: { matPercent } } }), env)).map(
            (card) => {
              const g = sideGaps(card);
              return { fx: (g.left - g.right) / 2, fy: (g.top - g.bottom) / 2 };
            },
          );
        const a = floats(30);
        const b = floats(30.5);
        for (let i = 0; i < a.length; i++) {
          expect(Math.abs(b[i].fx - a[i].fx)).toBeLessThan(1);
          expect(Math.abs(b[i].fy - a[i].fy)).toBeLessThan(1);
        }
      }),
    );
  });
});

describe("mat: layer visibility toggles", () => {
  it("emits per-card visibility flags for outer / inner / text driven by state.visibility", () => {
    const state = matState({ text: "x", visibility: { outer: true, inner: false, text: false } });
    const [card] = allCards(computeLayout(state, env));
    expect(card.outer.visible).toBe(true);
    expect(card.inner.visible).toBe(false);
    expect(card.textVisible).toBe(false);
  });

  it("hiding the outer layer still leaves the inner and text visible (inner-then-mat two-pass)", () => {
    const state = matState({ text: "x", visibility: { outer: false, inner: true, text: true } });
    const [card] = allCards(computeLayout(state, env));
    expect(card.outer.visible).toBe(false);
    expect(card.inner.visible).toBe(true);
    expect(card.textVisible).toBe(true);
  });

  it("the border on/off toggle still composes with the layer-visibility toggle for the inner", () => {
    // Turning the inner border off (story 19) OR hiding the inner layer (story 27)
    // both hide the inner; they are independent switches.
    const off = allCards(computeLayout(matState({ text: "x", card: { inner: { visible: false } } }), env))[0];
    expect(off.inner.visible).toBe(false);
  });
});

describe("mat: determinism", () => {
  it("same state → structurally identical LayoutResult (mat float included)", () => {
    fc.assert(
      fc.property(fc.integer(), fc.double({ min: 10, max: 50, noNaN: true }), (seed, matPercent) => {
        const state = matState({ text: "January February March", seed, card: { outer: { matPercent } } });
        expect(computeLayout(state, env)).toEqual(computeLayout(state, env));
      }),
    );
  });
});
