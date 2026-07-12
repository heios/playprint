import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

/**
 * Issue #2: type text → bordered cards on an SVG page (Grid, uniform).
 * All assertions go THROUGH computeLayout on the LayoutResult tree
 * (SPEC.md "Testing Decisions" — assert external engine behaviour, not DOM).
 */

const env = createStubEnv({ charWidthMm: 5 });

/** Flatten every card across every page of a LayoutResult. */
function allCards(result) {
  return result.pages.flatMap((page) => page.cards);
}

/** The rendered text of a card = concatenated glyph chars, in order. */
function cardText(card) {
  return card.glyphs.map((g) => g.char).join("");
}

describe("tokenization → cards", () => {
  it("makes one bordered card per whitespace-separated token", () => {
    const result = computeLayout(makeState({ text: "January February March" }), env);
    const cards = allCards(result);

    expect(cards.map(cardText)).toEqual(["January", "February", "March"]);
  });

  it("keeps duplicate tokens as duplicate cards (so 1 1 2 2 builds dates)", () => {
    const result = computeLayout(makeState({ text: "1 1 2 2" }), env);
    expect(allCards(result).map(cardText)).toEqual(["1", "1", "2", "2"]);
  });

  it("collapses runs of spaces/tabs between tokens", () => {
    const result = computeLayout(makeState({ text: "a   \t  b" }), env);
    expect(allCards(result).map(cardText)).toEqual(["a", "b"]);
  });

  it("produces no cards for empty or whitespace-only text", () => {
    expect(allCards(computeLayout(makeState({ text: "" }), env))).toEqual([]);
    expect(allCards(computeLayout(makeState({ text: "   \n  " }), env))).toEqual([]);
  });

  it("gives every card a rectangular inner border and glyphs", () => {
    const result = computeLayout(makeState({ text: "hi" }), env);
    const [card] = allCards(result);

    expect(card).toHaveProperty("innerRect");
    expect(card).toHaveProperty("outerRect");
    expect(card.glyphs.length).toBe(2);
    for (const g of card.glyphs) {
      expect(g).toMatchObject({ char: expect.any(String), x: expect.any(Number), y: expect.any(Number), rotationDeg: expect.any(Number) });
    }
  });

  it("emits a render-ready baseline glyph.y: run top edge dropped by the measured ascent", () => {
    // The engine owns ALL vertical geometry so the mm-tree is directly drawable
    // and the SVG/PDF renderers add no offset of their own (SPEC.md: preview and
    // PDF share the same metrics and match exactly). The baseline is derived from
    // the env's measured ascent, consistent with the engine's own vertical
    // centring metric (the measured run height) — not a hardcoded ~1em value.
    const ascentFraction = 0.8;
    const state = makeState({ text: "hi", card: { paddingMm: 4, font: { sizePt: 24 } } });
    const baselineEnv = createStubEnv({ charWidthMm: 5, ascentFraction });
    const [card] = allCards(computeLayout(state, baselineEnv));

    // Recompute the engine's inputs through the SAME env: the run box centred in
    // the cell, and the baseline `ascent` below the run's top edge.
    const { heightMm: runHeightMm, ascentMm } = baselineEnv.measureText("hi", { sizePt: 24 });
    const runTopMm = card.innerRect.yMm + (card.innerRect.heightMm - runHeightMm) / 2;
    const expectedBaseline = runTopMm + ascentMm;

    for (const g of card.glyphs) {
      expect(g.y).toBeCloseTo(expectedBaseline, 6);
      // The baseline is strictly below the run's top edge (it is NOT the top edge).
      expect(g.y).toBeGreaterThan(runTopMm);
    }
  });
});

describe("rows: newlines, blank lines, alignment", () => {
  it("forces a hard row break at each newline", () => {
    const result = computeLayout(makeState({ text: "one two\nthree" }), env);
    const cards = allCards(result);
    const yByToken = new Map(cards.map((c) => [cardText(c), c.innerRect.yMm]));

    // "one" and "two" share a row; "three" is on a lower row.
    expect(yByToken.get("one")).toBe(yByToken.get("two"));
    expect(yByToken.get("three")).toBeGreaterThan(yByToken.get("one"));
  });

  it("keeps a blank line as an empty row that pushes the next row down", () => {
    const withBlank = computeLayout(makeState({ text: "a\n\nb" }), env);
    const withoutBlank = computeLayout(makeState({ text: "a\nb" }), env);

    const bWith = allCards(withBlank).find((c) => cardText(c) === "b");
    const bWithout = allCards(withoutBlank).find((c) => cardText(c) === "b");

    // The extra empty row adds one row's worth of vertical advance.
    expect(bWith.innerRect.yMm).toBeGreaterThan(bWithout.innerRect.yMm);
  });

  it("soft-wraps a single over-wide line onto more rows so nothing runs off the page", () => {
    // A tiny page so a handful of uniform cards can't fit on one row.
    const state = makeState({
      text: "aa bb cc dd ee ff gg hh",
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);
    const cards = allCards(result);

    const distinctRows = new Set(cards.map((c) => c.innerRect.yMm));
    expect(distinctRows.size).toBeGreaterThan(1);

    // No card's right edge exceeds the page's usable width.
    const usableRight = pageUsableRight(state);
    for (const c of cards) {
      expect(c.outerRect.xMm + c.outerRect.widthMm).toBeLessThanOrEqual(usableRight + 1e-6);
    }
  });
});

describe("uniform sizing", () => {
  it("gives every card one shared footprint (aligned columns) regardless of token width", () => {
    const result = computeLayout(makeState({ text: "a strawberry x" }), env);
    const cards = allCards(result);

    const widths = new Set(cards.map((c) => round(c.outerRect.widthMm)));
    const heights = new Set(cards.map((c) => round(c.outerRect.heightMm)));
    expect(widths.size).toBe(1);
    expect(heights.size).toBe(1);
  });

  it("aligns cards into columns: same column ⇒ same x, same row ⇒ same y", () => {
    const result = computeLayout(makeState({ text: "aa bb\ncc dd" }), env);
    const cards = allCards(result);
    const [aa, bb, cc, dd] = cards;

    expect(round(aa.outerRect.xMm)).toBe(round(cc.outerRect.xMm)); // column 0
    expect(round(bb.outerRect.xMm)).toBe(round(dd.outerRect.xMm)); // column 1
    expect(aa.outerRect.yMm).toBe(bb.outerRect.yMm); // row 0
    expect(cc.outerRect.yMm).toBe(dd.outerRect.yMm); // row 1
  });

  it("footprint widens with the widest token, driven by measured text width", () => {
    const narrow = computeLayout(makeState({ text: "a b" }), env);
    const wide = computeLayout(makeState({ text: "a strawberry" }), env);

    const wNarrow = allCards(narrow)[0].innerRect.widthMm;
    const wWide = allCards(wide)[0].innerRect.widthMm;
    expect(wWide).toBeGreaterThan(wNarrow);
  });
});

describe("border geometry: padding, stroke, radius, gap, on/off", () => {
  it("padding spaces the word away from the inner border on all sides", () => {
    const small = computeLayout(makeState({ text: "ab", card: { paddingMm: 2 } }), env);
    const big = computeLayout(makeState({ text: "ab", card: { paddingMm: 8 } }), env);

    const wSmall = allCards(small)[0].innerRect.widthMm;
    const wBig = allCards(big)[0].innerRect.widthMm;
    // More padding ⇒ wider inner border (word width is identical).
    expect(wBig - wSmall).toBeCloseTo(2 * (8 - 2), 5);
  });

  it("carries border colour, stroke width (mm) and corner radius onto each card", () => {
    const state = makeState({
      text: "x",
      card: { inner: { color: "#ff0000", strokeMm: 1.5, radiusMm: 3 } },
    });
    const [card] = allCards(computeLayout(state, env));

    expect(card.inner).toMatchObject({ color: "#ff0000", strokeMm: 1.5, radiusMm: 3, visible: true });
  });

  it("turns the border off without removing the card's footprint", () => {
    const state = makeState({ text: "x", card: { inner: { visible: false } } });
    const [card] = allCards(computeLayout(state, env));

    expect(card.inner.visible).toBe(false);
    expect(card.innerRect.widthMm).toBeGreaterThan(0);
  });

  it("spaces neighbouring cards by the gap control", () => {
    const tight = computeLayout(makeState({ text: "a b", layout: { gapMm: 2 } }), env);
    const loose = computeLayout(makeState({ text: "a b", layout: { gapMm: 10 } }), env);

    const gapOf = (result) => {
      const [c0, c1] = allCards(result);
      return c1.outerRect.xMm - (c0.outerRect.xMm + c0.outerRect.widthMm);
    };
    expect(gapOf(tight)).toBeCloseTo(2, 5);
    expect(gapOf(loose)).toBeCloseTo(10, 5);
  });
});

describe("SVG page frame", () => {
  it("exposes each page's paper dimensions in mm for the mm-viewBox renderer", () => {
    const state = makeState({ text: "x", page: { size: "A4", orientation: "portrait", marginMm: 15 } });
    const result = computeLayout(state, env);

    expect(result.pages[0].widthMm).toBeCloseTo(210, 5);
    expect(result.pages[0].heightMm).toBeCloseTo(297, 5);
  });

  it("swaps width/height in landscape orientation", () => {
    const state = makeState({ text: "x", page: { size: "A4", orientation: "landscape", marginMm: 15 } });
    const result = computeLayout(state, env);

    expect(result.pages[0].widthMm).toBeCloseTo(297, 5);
    expect(result.pages[0].heightMm).toBeCloseTo(210, 5);
  });
});

// --- helpers ---
function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
function pageUsableRight(state) {
  const dims = { A7: { w: 74, h: 105 } };
  const p = dims[state.page.size];
  const w = state.page.orientation === "landscape" ? p.h : p.w;
  return w - state.page.marginMm;
}
