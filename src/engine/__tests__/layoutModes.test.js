import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

/**
 * Issue #5: Flexible & Random layout modes, fit sizing, row alignment.
 * All assertions go THROUGH computeLayout on the LayoutResult tree
 * (SPEC.md "Testing Decisions" — assert external engine behaviour, not DOM).
 */

const env = createStubEnv({ charWidthMm: 5 });

function allCards(result) {
  return result.pages.flatMap((page) => page.cards);
}
function cardText(card) {
  return card.glyphs.map((g) => g.char).join("");
}
function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

describe("fit card sizing (SPEC.md stories 11–12)", () => {
  it("varies widths per token but keeps heights uniform", () => {
    const state = makeState({
      text: "a strawberry xy",
      layout: { mode: "flexible", cardSizing: "fit" },
    });
    const cards = allCards(computeLayout(state, env));

    const widths = new Set(cards.map((c) => round(c.innerRect.widthMm)));
    const heights = new Set(cards.map((c) => round(c.innerRect.heightMm)));
    // Three tokens of different lengths ⇒ at least two distinct widths.
    expect(widths.size).toBeGreaterThan(1);
    // Heights stay uniform in fit mode (story 12).
    expect(heights.size).toBe(1);
  });

  it("makes a fit card hug its own content: 'a' is narrower than 'strawberry'", () => {
    const state = makeState({
      text: "a strawberry",
      layout: { mode: "flexible", cardSizing: "fit" },
    });
    const cards = allCards(computeLayout(state, env));
    const a = cards.find((c) => cardText(c) === "a");
    const straw = cards.find((c) => cardText(c) === "strawberry");
    expect(a.innerRect.widthMm).toBeLessThan(straw.innerRect.widthMm);
  });

  it("leaves uniform mode unchanged: one shared footprint", () => {
    const state = makeState({
      text: "a strawberry xy",
      layout: { mode: "flexible", cardSizing: "uniform" },
    });
    const cards = allCards(computeLayout(state, env));
    const widths = new Set(cards.map((c) => round(c.innerRect.widthMm)));
    expect(widths.size).toBe(1);
  });
});

describe("Flexible mode: tight ragged rows (SPEC.md story 38)", () => {
  it("packs fit cards tightly so each row's width sums the card widths + gaps", () => {
    const state = makeState({
      text: "a bb ccc",
      layout: { mode: "flexible", cardSizing: "fit", gapMm: 3, rowAlign: "left" },
      page: { size: "A3", orientation: "landscape", marginMm: 10 },
    });
    const cards = allCards(computeLayout(state, env));
    // All on one wide row: neighbouring cards are separated by exactly gapMm,
    // and packed tight (not on a uniform grid pitch).
    const sorted = [...cards].sort((c1, c2) => c1.innerRect.xMm - c2.innerRect.xMm);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const gap = sorted[i].outerRect.xMm - (prev.outerRect.xMm + prev.outerRect.widthMm);
      expect(gap).toBeCloseTo(3, 5);
    }
    // Cards have DIFFERENT widths (ragged, not uniform pitch).
    const widths = new Set(sorted.map((c) => round(c.innerRect.widthMm)));
    expect(widths.size).toBeGreaterThan(1);
  });

  it("respects newlines as hard row breaks", () => {
    const state = makeState({
      text: "a b\nc",
      layout: { mode: "flexible", cardSizing: "fit" },
      page: { size: "A3", orientation: "landscape", marginMm: 10 },
    });
    const cards = allCards(computeLayout(state, env));
    const y = (t) => cards.find((c) => cardText(c) === t).innerRect.yMm;
    expect(y("a")).toBe(y("b"));
    expect(y("c")).toBeGreaterThan(y("a"));
  });

  it("reflows onto more rows when a row is wider than the page", () => {
    const state = makeState({
      text: "aa bb cc dd ee ff gg hh",
      layout: { mode: "flexible", cardSizing: "fit" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const cards = allCards(computeLayout(state, env));
    const distinctRows = new Set(cards.map((c) => round(c.innerRect.yMm)));
    expect(distinctRows.size).toBeGreaterThan(1);
    const dims = { A7: { w: 74, h: 105 } };
    const usableRight = dims.A7.w - 5;
    for (const c of cards) {
      expect(c.outerRect.xMm + c.outerRect.widthMm).toBeLessThanOrEqual(usableRight + 1e-6);
    }
  });
});

describe("row alignment (SPEC.md story 41)", () => {
  it("left/center/right shift a row's block within the usable width", () => {
    const base = { text: "a bb", layout: { mode: "flexible", cardSizing: "fit" }, page: { size: "A3", orientation: "landscape", marginMm: 10 } };
    const leftFirst = allCards(computeLayout(makeState({ ...base, layout: { ...base.layout, rowAlign: "left" } }), env))
      .sort((a, b) => a.outerRect.xMm - b.outerRect.xMm)[0];
    const centerFirst = allCards(computeLayout(makeState({ ...base, layout: { ...base.layout, rowAlign: "center" } }), env))
      .sort((a, b) => a.outerRect.xMm - b.outerRect.xMm)[0];
    const rightFirst = allCards(computeLayout(makeState({ ...base, layout: { ...base.layout, rowAlign: "right" } }), env))
      .sort((a, b) => a.outerRect.xMm - b.outerRect.xMm)[0];

    expect(leftFirst.outerRect.xMm).toBeLessThan(centerFirst.outerRect.xMm);
    expect(centerFirst.outerRect.xMm).toBeLessThan(rightFirst.outerRect.xMm);
  });
});

describe("Random mode: clamp-to-cell scatter (SPEC.md stories 39–40)", () => {
  const scatterState = (over = {}) =>
    makeState({
      text: "January February March April May June",
      layout: { mode: "random", random: { rotationDeg: 20, shiftMm: 15 } },
      ...over,
    });

  it("flattens newlines: newline text scatters the same as space-joined text", () => {
    const withNewlines = allCards(computeLayout(scatterState({ text: "a b\nc d" }), env)).map(cardText).sort();
    const withSpaces = allCards(computeLayout(scatterState({ text: "a b c d" }), env)).map(cardText).sort();
    expect(withNewlines).toEqual(withSpaces);
    expect(withNewlines).toEqual(["a", "b", "c", "d"]);
  });

  it("tilts each card (non-zero tiltDeg somewhere) when rotation amount > 0", () => {
    const cards = allCards(computeLayout(scatterState(), env));
    expect(cards.some((c) => Math.abs(c.tiltDeg) > 1e-6)).toBe(true);
  });

  it("keeps every card's rotated footprint inside its own cell → no two cards overlap", () => {
    // Try several token counts and amounts; the clamp-to-cell invariant must
    // hold for all so every card stays cleanly cuttable (story 40).
    for (const text of ["a b c d", "one two three four five", "x y z w q r s t u v"]) {
      for (const rotationDeg of [0, 10, 30, 45]) {
        for (const shiftMm of [0, 10, 40]) {
          const state = scatterState({ text, layout: { mode: "random", random: { rotationDeg, shiftMm } } });
          const cards = allCards(computeLayout(state, env));
          const boxes = cards.map(rotatedFootprint);
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              expect(overlaps(boxes[i], boxes[j])).toBe(false);
            }
          }
        }
      }
    }
  });

  it("spreads cards across the usable page area (large cells span the page)", () => {
    const cards = allCards(computeLayout(scatterState(), env));
    const xs = cards.map((c) => c.outerRect.xMm);
    const ys = cards.map((c) => c.outerRect.yMm);
    // Cards do not all pile at one spot — they span a meaningful extent.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20);
  });

  it("stays inside the page usable area (no card crosses the margin)", () => {
    const state = scatterState();
    const cards = allCards(computeLayout(state, env));
    const marginMm = 15;
    const page = computeLayout(state, env).pages[0];
    for (const box of cards.map(rotatedFootprint)) {
      expect(box.minX).toBeGreaterThanOrEqual(marginMm - 1e-6);
      expect(box.minY).toBeGreaterThanOrEqual(marginMm - 1e-6);
      expect(box.maxX).toBeLessThanOrEqual(page.widthMm - marginMm + 1e-6);
      expect(box.maxY).toBeLessThanOrEqual(page.heightMm - marginMm + 1e-6);
    }
  });
});

describe("Random scatter determinism & continuity (SPEC.md story 35 / #3 reuse)", () => {
  const base = { text: "one two three four five six", layout: { mode: "random", random: { rotationDeg: 15, shiftMm: 10 } }, seed: 7 };

  it("is deterministic: same state → identical LayoutResult", () => {
    const s = makeState(base);
    expect(computeLayout(s, env)).toEqual(computeLayout(s, env));
  });

  it("morphs continuously as the shift amount grows (no reshuffle)", () => {
    const a = allCards(computeLayout(makeState({ ...base, layout: { mode: "random", random: { rotationDeg: 15, shiftMm: 10 } } }), env));
    const b = allCards(computeLayout(makeState({ ...base, layout: { mode: "random", random: { rotationDeg: 15, shiftMm: 10.3 } } }), env));
    for (let i = 0; i < a.length; i++) {
      const dx = b[i].outerRect.xMm - a[i].outerRect.xMm;
      const dy = b[i].outerRect.yMm - a[i].outerRect.yMm;
      expect(Math.hypot(dx, dy)).toBeLessThan(2);
    }
  });

  it("reshuffles only on a new seed", () => {
    const a = allCards(computeLayout(makeState({ ...base, seed: 7 }), env));
    const b = allCards(computeLayout(makeState({ ...base, seed: 8 }), env));
    // Some card moved meaningfully when the seed changed.
    const moved = a.some((c, i) => Math.hypot(c.outerRect.xMm - b[i].outerRect.xMm, c.outerRect.yMm - b[i].outerRect.yMm) > 1);
    expect(moved).toBe(true);
  });
});

describe("Random mode pagination (SPEC.md: Random paginates when tokens exceed a page)", () => {
  it("splits onto multiple pages when tokens exceed one page's cells", () => {
    // Many tokens on a tiny page → more than one page.
    const many = Array.from({ length: 40 }, (_, i) => `t${i}`).join(" ");
    const state = makeState({
      text: many,
      layout: { mode: "random", random: { rotationDeg: 10, shiftMm: 5 } },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);
    expect(result.pages.length).toBeGreaterThan(1);
    // Every token still appears exactly once across all pages.
    const texts = allCards(result).map(cardText);
    expect(texts.length).toBe(40);
  });
});

// --- geometry helpers for the no-overlap check ---

/**
 * The axis-aligned bounding box of a card's outer rect after applying its
 * per-card tilt about `tiltOriginMm` (the transform the renderer applies).
 * A conservative AABB is enough: if AABBs don't overlap, the tilted rects
 * (which are inside their AABBs) don't overlap either.
 */
function rotatedFootprint(card) {
  const r = card.outerRect;
  const o = card.tiltOriginMm ?? { xMm: r.xMm + r.widthMm / 2, yMm: r.yMm + r.heightMm / 2 };
  const rad = ((card.tiltDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [r.xMm, r.yMm],
    [r.xMm + r.widthMm, r.yMm],
    [r.xMm + r.widthMm, r.yMm + r.heightMm],
    [r.xMm, r.yMm + r.heightMm],
  ].map(([x, y]) => {
    const dx = x - o.xMm;
    const dy = y - o.yMm;
    return [o.xMm + dx * cos - dy * sin, o.yMm + dx * sin + dy * cos];
  });
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function overlaps(a, b) {
  const EPS = 1e-6;
  return a.minX < b.maxX - EPS && b.minX < a.maxX - EPS && a.minY < b.maxY - EPS && b.minY < a.maxY - EPS;
}
