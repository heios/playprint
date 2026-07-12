/**
 * Minimal stub of the `env` the engine expects at runtime: page-side text
 * measurement, so tests never need a DOM/canvas.
 *
 * SPEC.md: "`env` supplies text-measurement (page-side canvas `measureText`,
 * so preview and PDF share the same metrics and match exactly)."
 *
 * `measureText` returns `ascentMm` (top edge → baseline) alongside the run box
 * so the engine can emit a render-ready baseline `glyph.y`. The stub keeps a
 * fixed ascent fraction of the run height so tests can predict the baseline.
 */
export function createStubEnv({ charWidthMm = 5, ascentFraction = 0.8 } = {}) {
  return {
    measureText(text, { sizePt } = {}) {
      const scale = sizePt ? sizePt / 12 : 1;
      const heightMm = charWidthMm * 1.4 * scale;
      return { widthMm: text.length * charWidthMm * scale, heightMm, ascentMm: heightMm * ascentFraction };
    },
  };
}
