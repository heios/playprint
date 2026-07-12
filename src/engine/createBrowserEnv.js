// @ts-check
/** @import { Env } from './types.js' */

const MM_PER_PT = 0.352778;

/**
 * The real `env` the app hands to `computeLayout` at runtime: a page-side
 * canvas `measureText`, so preview and PDF measure text identically
 * (SPEC.md "Single source of truth: the layout engine"). Kept out of
 * `computeLayout.js` and its passes entirely, so the pure engine has zero
 * DOM dependency and stays unit-testable with the stub env (see
 * `./__tests__/stubEnv.js`).
 *
 * `heightMm` is the line-box height; `ascentMm` is the distance from that box's
 * top edge down to the text baseline, so the engine can emit a render-ready
 * baseline `glyph.y` and the renderers add no vertical offset.
 *
 * @returns {Env}
 */
export function createBrowserEnv() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  return {
    measureText(text, opts = {}) {
      const { sizePt = 24, fontFamily = "sans-serif" } = opts;
      ctx.font = `${sizePt}pt ${fontFamily}`;
      const metrics = ctx.measureText(text);
      const widthPt = metrics.width;

      // Line-box height (1.2em) and the font's ascent/descent from the baseline.
      const heightMm = sizePt * MM_PER_PT * 1.2;
      const ascentPt = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? sizePt * 0.8;
      const descentPt = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? sizePt * 0.2;

      // Centre the ascent+descent glyph box in the line box, so the baseline sits
      // (leading/2 + ascent) below the line-box top edge.
      const glyphBoxMm = (ascentPt + descentPt) * MM_PER_PT;
      const leadingMm = Math.max(0, heightMm - glyphBoxMm);
      const ascentMm = leadingMm / 2 + ascentPt * MM_PER_PT;

      return { widthMm: widthPt * MM_PER_PT, heightMm, ascentMm };
    },
  };
}
