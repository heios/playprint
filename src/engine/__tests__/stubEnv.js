/**
 * Minimal stub of the `env` the engine expects at runtime: page-side text
 * measurement, so tests never need a DOM/canvas.
 *
 * SPEC.md: "`env` supplies text-measurement (page-side canvas `measureText`,
 * so preview and PDF share the same metrics and match exactly)."
 */
export function createStubEnv({ charWidthMm = 5 } = {}) {
  return {
    measureText(text, { sizePt } = {}) {
      const scale = sizePt ? sizePt / 12 : 1;
      return { widthMm: text.length * charWidthMm * scale, heightMm: charWidthMm * 1.4 * scale };
    },
  };
}
