import { describe, expect, it } from "vitest";
import { widestCardIndex } from "../renderSecondPreview.js";
import { computeLayout } from "../../engine/computeLayout.js";
import { createStubEnv } from "../../engine/__tests__/stubEnv.js";
import { makeState } from "../../engine/__tests__/testState.js";

/**
 * `widestCardIndex` is the pure selection logic backing the second preview's
 * default (SPEC.md story 55: "default the widest"). Kept DOM-free so it's
 * directly testable, independent of the SVG drawing it feeds.
 */
describe("widestCardIndex", () => {
  it("returns -1 for an empty page", () => {
    expect(widestCardIndex({ cards: [] })).toBe(-1);
    expect(widestCardIndex(undefined)).toBe(-1);
  });

  it("picks the single widest card's index", () => {
    const page = {
      cards: [{ outerRect: { widthMm: 10 } }, { outerRect: { widthMm: 40 } }, { outerRect: { widthMm: 20 } }],
    };
    expect(widestCardIndex(page)).toBe(1);
  });

  it("breaks ties by keeping the first widest in document order", () => {
    const page = {
      cards: [{ outerRect: { widthMm: 30 } }, { outerRect: { widthMm: 30 } }],
    };
    expect(widestCardIndex(page)).toBe(0);
  });

  it("picks the widest real card out of computeLayout's output (fit sizing, ragged widths)", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({
      text: "a strawberry xy",
      layout: { mode: "flexible", cardSizing: "fit" },
    });
    const result = computeLayout(state, env);
    const page = result.pages[0];
    const idx = widestCardIndex(page);
    const chosenWidth = page.cards[idx].outerRect.widthMm;
    for (const card of page.cards) {
      expect(card.outerRect.widthMm).toBeLessThanOrEqual(chosenWidth);
    }
    // "strawberry" is the longest token, so it should be the widest card.
    const chosenText = page.cards[idx].glyphs.map((g) => g.char).join("");
    expect(chosenText).toBe("strawberry");
  });
});
