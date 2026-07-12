import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

/**
 * Issue #6: content paginates automatically across multiple pages in Grid,
 * Flexible, and Random modes (SPEC.md user story 46, "Layout modes: ... All
 * modes paginate across as many pages as needed", Testing Decisions
 * "Pagination: token counts that exceed one page produce the expected number
 * of pages").
 *
 * Random-mode pagination is already covered by layoutModes.test.js; this file
 * adds the Grid/Flexible coverage plus determinism/no-overflow invariants that
 * apply across all three modes.
 */

const env = createStubEnv({ charWidthMm: 5 });

function allCards(result) {
  return result.pages.flatMap((page) => page.cards);
}
function cardText(card) {
  return card.glyphs.map((g) => g.char).join("");
}

describe("Grid mode pagination (SPEC.md story 46)", () => {
  it("splits onto multiple pages when rows exceed one page's usable height", () => {
    // Many single-column rows (forced by newlines) on a tiny page: each row
    // takes a full line, so a handful of rows already overflows A7's height.
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    const state = makeState({
      text: many,
      layout: { mode: "grid" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);

    expect(result.pages.length).toBeGreaterThan(1);
    // Every token still appears exactly once across all pages.
    const texts = allCards(result).map(cardText);
    expect(texts.length).toBe(20);
    expect(new Set(texts).size).toBe(20);
  });

  it("keeps every card's outer rect within its own page's printable area", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    const state = makeState({
      text: many,
      layout: { mode: "grid" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);

    for (const page of result.pages) {
      for (const card of page.cards) {
        expect(card.outerRect.yMm).toBeGreaterThanOrEqual(0);
        expect(card.outerRect.yMm + card.outerRect.heightMm).toBeLessThanOrEqual(page.heightMm + 1e-6);
      }
    }
  });

  it("fits everything on one page when content is short", () => {
    const state = makeState({
      text: "January February March",
      layout: { mode: "grid" },
    });
    const result = computeLayout(state, env);
    expect(result.pages.length).toBe(1);
  });

  it("never strands the first row of a page: a single row taller than the whole page still lands on it", () => {
    const state = makeState({
      text: "onlyone",
      layout: { mode: "grid" },
      card: { font: { sizePt: 500 } },
      page: { size: "A10", orientation: "portrait", marginMm: 2 },
    });
    const result = computeLayout(state, env);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].cards.length).toBe(1);
  });

  it("blank spacer rows that push content past the page bottom still trigger pagination", () => {
    const state = makeState({
      text: "a\n\n\n\n\n\n\n\n\n\nb",
      layout: { mode: "grid" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);
    expect(result.pages.length).toBe(2);
    expect(result.pages[0].cards.map(cardText)).toEqual(["a"]);
    expect(result.pages[1].cards.map(cardText)).toEqual(["b"]);
  });
});

describe("Flexible mode pagination (SPEC.md story 46)", () => {
  it("splits onto multiple pages when rows exceed one page's usable height", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    const state = makeState({
      text: many,
      layout: { mode: "flexible", cardSizing: "fit" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);

    expect(result.pages.length).toBeGreaterThan(1);
    const texts = allCards(result).map(cardText);
    expect(texts.length).toBe(20);
    expect(new Set(texts).size).toBe(20);
  });

  it("keeps every card's outer rect within its own page's printable area", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    const state = makeState({
      text: many,
      layout: { mode: "flexible", cardSizing: "fit" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);

    for (const page of result.pages) {
      for (const card of page.cards) {
        expect(card.outerRect.yMm).toBeGreaterThanOrEqual(0);
        expect(card.outerRect.yMm + card.outerRect.heightMm).toBeLessThanOrEqual(page.heightMm + 1e-6);
      }
    }
  });
});

describe("Pagination determinism (SPEC.md Testing Decisions)", () => {
  it("produces an identical LayoutResult for the same state across modes", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    for (const mode of ["grid", "flexible", "random"]) {
      const state = makeState({
        text: many,
        layout: { mode, cardSizing: "fit", random: { rotationDeg: 10, shiftMm: 5 } },
        page: { size: "A7", orientation: "portrait", marginMm: 5 },
      });
      const a = computeLayout(state, env);
      const b = computeLayout(state, env);
      expect(a).toEqual(b);
    }
  });

  it("every page carries the same paper dimensions and margin", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    const state = makeState({
      text: many,
      layout: { mode: "grid" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const result = computeLayout(state, env);
    expect(result.pages.length).toBeGreaterThan(1);
    for (const page of result.pages) {
      expect(page.widthMm).toBe(result.pages[0].widthMm);
      expect(page.heightMm).toBe(result.pages[0].heightMm);
      expect(page.marginMm).toBe(5);
    }
  });
});
