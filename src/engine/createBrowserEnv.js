const MM_PER_PT = 0.352778;

/**
 * The real `env` the app hands to `computeLayout` at runtime: a page-side
 * canvas `measureText`, so preview and PDF measure text identically
 * (SPEC.md "Single source of truth: the layout engine"). Kept out of
 * `computeLayout.js` and its passes entirely, so the pure engine has zero
 * DOM dependency and stays unit-testable with the stub env (see
 * `./__tests__/stubEnv.js`).
 *
 * @returns {{ measureText(text: string, opts?: { sizePt?: number, fontFamily?: string }): { widthMm: number, heightMm: number } }}
 */
export function createBrowserEnv() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  return {
    measureText(text, { sizePt = 24, fontFamily = "sans-serif" } = {}) {
      ctx.font = `${sizePt}pt ${fontFamily}`;
      const metrics = ctx.measureText(text);
      const widthPt = metrics.width;
      return {
        widthMm: widthPt * MM_PER_PT,
        heightMm: sizePt * MM_PER_PT * 1.2,
      };
    },
  };
}
