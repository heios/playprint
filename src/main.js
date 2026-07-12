import "./controls/groups/index.js"; // registers all control groups (side effect)
import { computeLayout } from "./engine/computeLayout.js";
import { createBrowserEnv } from "./engine/createBrowserEnv.js";
import { defaultState } from "./engine/defaultState.js";
import { renderControls } from "./controls/renderControls.js";
import { renderSvgPreview } from "./render/renderSvgPreview.js";
import { renderSecondPreview, widestCardIndex } from "./render/renderSecondPreview.js";
import { loadFont } from "./fonts/loadFont.js";
import { COMIC_NEUE_FAMILY } from "./fonts/comicNeue.js";
import { exportPdf } from "./export/exportPdf.js";
import "./style.css";

/**
 * App wiring: text box → live preview of the paginated sheets, plus the
 * second (enlarged single-card) preview, plus font loading (issue #7). The
 * single ProjectState drives everything — controls return a new state,
 * `computeLayout` turns it into geometry, and the thin SVG renderers draw
 * that geometry. Later slices (PDF, projects) extend the same seam.
 *
 * `ui` holds view-only state that never reaches the engine (SPEC.md: the
 * engine is pure and DOM-free) — which page/card the second preview shows
 * and the main preview's zoom level (stories 52–55).
 *
 * Font loading is likewise kept OUTSIDE `ProjectState`: `fontStatus` is
 * transient (in-flight download progress), not a persisted project setting
 * (SPEC.md: "network kept out of the pure engine" — and, by the same logic,
 * out of the serializable state issue #9 will round-trip). `computeLayout`
 * never awaits it; the preview simply re-renders once the font resolves, so
 * `state.card.font.family` (already threaded through `env.measureText` in
 * `passes/size.js`/`passes/letterTransforms.js`) measures against the real
 * glyphs the moment they're available — no engine change needed. Both the
 * main and second previews read the same `renderOpts.fontFamily`, so a
 * newly-registered `FontFace` shows up in both at once (SPEC.md: "the
 * selected font is reflected in both previews").
 */
let state = { ...defaultState(), text: "January February March" };
const ui = { zoomPercent: 100, selectedPageIndex: 0, selectedCardIndex: null };
const env = createBrowserEnv();

/** @type {{ state: "idle"|"loading"|"ready"|"error", family?: string, loadedBytes?: number, totalBytes?: number|null }} */
let fontStatus = { state: "idle" };
let loadedFontKey = null; // `${source}:${family}` of the font currently registered/ready
let loadedFontTtfBytes = null; // the resolved font's raw TTF bytes (issue #8: PDF embedding needs these)

const app = document.querySelector("#app");
app.innerHTML = `
  <h1>playprint</h1>
  <p>Type words below — every whitespace-separated token becomes a bordered cut-out card.</p>
  <div id="controls"></div>
  <div id="preview-toolbar">
    <label>Zoom (%) <input id="zoom" type="range" min="25" max="200" step="5" /></label>
    <label>Page <select id="page-select"></select></label>
    <button id="download-pdf" type="button">Download PDF</button>
  </div>
  <div id="second-preview"></div>
  <div id="preview"></div>
`;

const controlsEl = document.querySelector("#controls");
const previewEl = document.querySelector("#preview");
const secondPreviewEl = document.querySelector("#second-preview");
const zoomEl = document.querySelector("#zoom");
const pageSelectEl = document.querySelector("#page-select");
const downloadPdfEl = document.querySelector("#download-pdf");

zoomEl.addEventListener("input", (event) => {
  ui.zoomPercent = Number(event.target.value) || 100;
  render();
});
pageSelectEl.addEventListener("change", (event) => {
  ui.selectedPageIndex = Number(event.target.value) || 0;
  ui.selectedCardIndex = null; // a fresh page defaults back to its widest card
  render();
});
downloadPdfEl.addEventListener("click", () => downloadPdf());

function render() {
  renderControls(
    controlsEl,
    state,
    (next) => {
      state = next;
      render();
    },
    { fontStatus },
  );

  ensureFontLoaded(state.card?.font);

  const layoutResult = computeLayout(state, env);
  const renderOpts = {
    fontFamily: state.card?.font?.family,
    sizePt: state.card?.font?.sizePt,
    textColor: state.card?.textColor,
  };

  const mainPreview = renderSvgPreview(layoutResult, { ...renderOpts, zoomPercent: ui.zoomPercent });
  // Clicking any card in the main preview selects it for the second preview
  // (SPEC.md story 55: "choose which token the second preview shows"), and
  // also jumps the selected page to the one that was clicked.
  mainPreview.addEventListener("click", (event) => {
    const pageEl = event.target.closest(".preview-page");
    const cardEl = event.target.closest("g[data-card-index]");
    if (!pageEl || !cardEl) return;
    ui.selectedPageIndex = Number(pageEl.dataset.pageIndex);
    ui.selectedCardIndex = Number(cardEl.dataset.cardIndex);
    render();
  });
  previewEl.replaceChildren(mainPreview);

  // Keep the page selector in sync with however many pages this state paginates to.
  const pageCount = layoutResult.pages.length;
  ui.selectedPageIndex = Math.min(ui.selectedPageIndex, Math.max(0, pageCount - 1));
  pageSelectEl.replaceChildren(
    ...layoutResult.pages.map((_, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i + 1} / ${pageCount}`;
      if (i === ui.selectedPageIndex) opt.selected = true;
      return opt;
    }),
  );
  zoomEl.value = String(ui.zoomPercent);

  const selectedPage = layoutResult.pages[ui.selectedPageIndex];
  const cardIndex = ui.selectedCardIndex ?? widestCardIndex(selectedPage);
  secondPreviewEl.replaceChildren(renderSecondPreview(selectedPage, cardIndex, renderOpts));

  // Story 57: "Download disabled until the font is ready" — disabled unless
  // the CURRENTLY selected font (not just some previously-loaded one) has
  // finished loading and its TTF bytes are in hand to embed.
  downloadPdfEl.disabled = !(fontStatus.state === "ready" && currentFontKey() === loadedFontKey && loadedFontTtfBytes);
}

/**
 * Loads (fetch -> decode -> FontFace) whichever font the state currently
 * selects, if it isn't already loaded/loading. Both previews pick up the
 * result automatically: once the `FontFace` is registered, the SAME
 * `state`/`env` re-run of `computeLayout` (triggered by `render()` below)
 * measures and draws with the real glyphs (SPEC.md: "the selected font is
 * reflected in both previews").
 */
function ensureFontLoaded(font) {
  const family = font?.family ?? COMIC_NEUE_FAMILY;
  const source = font?.source ?? "builtin";
  const key = `${source}:${family}`;

  if (key === loadedFontKey || (fontStatus.state === "loading" && fontStatus.family === family)) return;

  fontStatus = { state: "loading", family, loadedBytes: 0, totalBytes: null };
  render();

  loadFont(font, {
    onProgress: ({ loadedBytes, totalBytes }) => {
      // Stale response guard: ignore progress from a font the maker has
      // since navigated away from (SPEC.md seeded-continuity spirit: no
      // surprise UI from an in-flight async op that no longer applies).
      if (`${source}:${family}` !== currentFontKey()) return;
      fontStatus = { state: "loading", family, loadedBytes, totalBytes };
      render();
    },
  })
    .then((resolved) => {
      loadedFontKey = key;
      loadedFontTtfBytes = resolved.ttfBytes;
      fontStatus = { state: "ready", family };
      render();
    })
    .catch((error) => {
      console.error(`Failed to load font "${family}":`, error);
      fontStatus = { state: "error", family };
      render();
    });
}

/** `${source}:${family}` for whatever font `state` currently selects. */
function currentFontKey() {
  const font = state.card?.font;
  return `${font?.source ?? "builtin"}:${font?.family ?? COMIC_NEUE_FAMILY}`;
}

/**
 * Story 56: "a single Download PDF button... the whole multi-page result in
 * one file." Builds the SAME `LayoutResult` the previews render (SPEC.md:
 * "same LayoutResult tree... shared metrics -> matches the preview exactly")
 * and hands it to `exportPdf` with the already-loaded font's TTF bytes
 * (story 51: "embedded in the PDF"). The button is disabled (see `render()`)
 * until `loadedFontTtfBytes` is actually in hand, so this never runs against
 * a stale/missing font (story 57).
 */
function downloadPdf() {
  if (downloadPdfEl.disabled || !loadedFontTtfBytes) return;

  const layoutResult = computeLayout(state, env);
  const bytes = exportPdf(layoutResult, {
    fontFamily: state.card?.font?.family ?? COMIC_NEUE_FAMILY,
    fontBytes: loadedFontTtfBytes,
    sizePt: state.card?.font?.sizePt,
    textColor: state.card?.textColor,
    returnBytes: true,
  });

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.name || "playprint"}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

render();
