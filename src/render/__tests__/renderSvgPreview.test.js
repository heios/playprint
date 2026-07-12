// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPageSvg, cardGroup } from "../renderSvgPreview.js";
import { computeLayout } from "../../engine/computeLayout.js";
import { createStubEnv } from "../../engine/__tests__/stubEnv.js";
import { makeState } from "../../engine/__tests__/testState.js";

/**
 * Regression test for issue #29: inside a `viewBox`'d SVG, `x`/`y` are
 * unitless user-coordinates but `font-size` was emitted with a `mm` suffix
 * (`"7.98mm"`), so it resolved against physical CSS pixels instead of the mm
 * user-coordinate space — glyphs ballooned ~2.6x and overprinted. The fix is
 * a unitless `font-size` in the same coordinate space as `x`/`y`.
 *
 * jsdom does no font layout, so real glyph overlap can't be measured here —
 * this asserts the attribute contract itself, which IS the defect.
 */
describe("glyph <text> font-size unit (issue #29)", () => {
  function firstGlyphFontSize(svg) {
    const text = svg.querySelector("text");
    expect(text).not.toBeNull();
    return text.getAttribute("font-size");
  }

  it("emits a bare unitless number on the all-pages preview (renderPageSvg)", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "may" });
    const result = computeLayout(state, env);
    const page = result.pages[0];

    const svg = renderPageSvg(page, { sizePt: 24 });
    const fontSize = firstGlyphFontSize(svg);

    expect(fontSize).toMatch(/^[0-9.]+$/);
  });

  it("emits a bare unitless number on the focused-card preview (cardGroup, shared by renderSecondPreview)", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "may" });
    const result = computeLayout(state, env);
    const card = result.pages[0].cards[0];

    const group = cardGroup(card, { fontFamily: "sans-serif", sizePt: 24, textColor: "#000000" });
    const text = group.querySelector("text");
    expect(text).not.toBeNull();

    expect(text.getAttribute("font-size")).toMatch(/^[0-9.]+$/);
  });
});
