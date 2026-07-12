import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

const env = createStubEnv({ charWidthMm: 5 });

function allCards(result) {
  return result.pages.flatMap((p) => p.cards);
}
function round(n) {
  return Math.round(n * 1e4) / 1e4;
}

describe("uniform-footprint invariant (property-based)", () => {
  it("all cards share one footprint for any multiset of tokens", () => {
    const token = fc.stringMatching(/^[a-z0-9]{1,10}$/);
    fc.assert(
      fc.property(fc.array(token, { minLength: 1, maxLength: 12 }), (tokens) => {
        const result = computeLayout(makeState({ text: tokens.join(" ") }), env);
        const cards = allCards(result);
        const widths = new Set(cards.map((c) => round(c.outerRect.widthMm)));
        const heights = new Set(cards.map((c) => round(c.outerRect.heightMm)));
        expect(widths.size).toBe(1);
        expect(heights.size).toBe(1);
      }),
    );
  });
});

describe("determinism (property-based)", () => {
  it("same state → structurally identical LayoutResult for arbitrary text/seed", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (text, seed) => {
        const state = makeState({ text, seed });
        expect(computeLayout(state, env)).toEqual(computeLayout(state, env));
      }),
    );
  });
});
