import "./controls/groups/index.js"; // registers all control groups (side effect)
import { computeLayout } from "./engine/computeLayout.js";
import { createBrowserEnv } from "./engine/createBrowserEnv.js";
import { defaultState } from "./engine/defaultState.js";
import { renderControls } from "./controls/renderControls.js";
import { renderSvgPreview } from "./render/renderSvgPreview.js";
import { renderSecondPreview, widestCardIndex } from "./render/renderSecondPreview.js";
import "./style.css";

/**
 * App wiring: text box → live preview of the paginated sheets, plus the
 * second (enlarged single-card) preview. The single ProjectState drives
 * everything — controls return a new state, `computeLayout` turns it into
 * geometry, and the thin SVG renderers draw that geometry. Later slices
 * (fonts, PDF, projects) extend the same seam.
 *
 * `ui` holds view-only state that never reaches the engine (SPEC.md: the
 * engine is pure and DOM-free) — which page/card the second preview shows
 * and the main preview's zoom level (stories 52–55).
 */
let state = { ...defaultState(), text: "January February March" };
const ui = { zoomPercent: 100, selectedPageIndex: 0, selectedCardIndex: null };
const env = createBrowserEnv();

const app = document.querySelector("#app");
app.innerHTML = `
  <h1>playprint</h1>
  <p>Type words below — every whitespace-separated token becomes a bordered cut-out card.</p>
  <div id="controls"></div>
  <div id="preview-toolbar">
    <label>Zoom (%) <input id="zoom" type="range" min="25" max="200" step="5" /></label>
    <label>Page <select id="page-select"></select></label>
  </div>
  <div id="second-preview"></div>
  <div id="preview"></div>
`;

const controlsEl = document.querySelector("#controls");
const previewEl = document.querySelector("#preview");
const secondPreviewEl = document.querySelector("#second-preview");
const zoomEl = document.querySelector("#zoom");
const pageSelectEl = document.querySelector("#page-select");

zoomEl.addEventListener("input", (event) => {
  ui.zoomPercent = Number(event.target.value) || 100;
  render();
});
pageSelectEl.addEventListener("change", (event) => {
  ui.selectedPageIndex = Number(event.target.value) || 0;
  ui.selectedCardIndex = null; // a fresh page defaults back to its widest card
  render();
});

function render() {
  renderControls(controlsEl, state, (next) => {
    state = next;
    render();
  });

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
}

render();
