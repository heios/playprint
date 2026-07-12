import "./controls/groups/index.js"; // registers all control groups (side effect)
import { computeLayout } from "./engine/computeLayout.js";
import { createBrowserEnv } from "./engine/createBrowserEnv.js";
import { defaultState } from "./engine/defaultState.js";
import { renderControls } from "./controls/renderControls.js";
import { renderSvgPreview } from "./render/renderSvgPreview.js";
import { renderSecondPreview, widestCardIndex } from "./render/renderSecondPreview.js";
import { loadFont } from "./fonts/loadFont.js";
import { COMIC_NEUE_FAMILY } from "./fonts/comicNeue.js";
import { readStateFromHash } from "./state/shareUrl.js";
import { renderProjectsPanel } from "./projects/renderProjectsPanel.js";
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
 *
 * Projects & sharing (issue #9, SPEC.md stories 58-62): a shared link's hash
 * fragment wins over the built-in starter state on first load (a colleague
 * opening a share link should see the shared design, not the default demo
 * text) — `readStateFromHash` returns `null` for an absent/corrupted hash,
 * so the fallback is untouched otherwise. `activeProjectId` tracks which
 * saved project (if any) the current state was loaded from/saved as, purely
 * for the panel's "Save" button; it is view-only UI state, never part of
 * `ProjectState` itself, same as `ui` below.
 */
const sharedState = readStateFromHash(window.location.hash);
let state = sharedState ?? { ...defaultState(), text: "January February March" };
let activeProjectId = null;
const ui = { zoomPercent: 100, selectedPageIndex: 0, selectedCardIndex: null };
const env = createBrowserEnv();
const storage = window.localStorage;

/** @type {{ state: "idle"|"loading"|"ready"|"error", family?: string, loadedBytes?: number, totalBytes?: number|null }} */
let fontStatus = { state: "idle" };
let loadedFontKey = null; // `${source}:${family}` of the font currently registered/ready

const app = document.querySelector("#app");
app.innerHTML = `
  <h1>playprint</h1>
  <p>Type words below — every whitespace-separated token becomes a bordered cut-out card.</p>
  <div id="projects"></div>
  <div id="controls"></div>
  <div id="preview-toolbar">
    <label>Zoom (%) <input id="zoom" type="range" min="25" max="200" step="5" /></label>
    <label>Page <select id="page-select"></select></label>
  </div>
  <div id="second-preview"></div>
  <div id="preview"></div>
`;

const projectsEl = document.querySelector("#projects");
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
  renderProjectsPanel(projectsEl, storage, state, (next, nextProjectId) => {
    state = next;
    activeProjectId = nextProjectId ?? null;
    render();
  }, {
    activeProjectId,
    locationHref: window.location.href,
    onCopyLink: copyShareLink,
    prompt: (message, defaultValue) => window.prompt(message, defaultValue),
    confirm: (message) => window.confirm(message),
  });

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
      if (`${source}:${family}` !== `${state.card?.font?.source ?? "builtin"}:${state.card?.font?.family ?? COMIC_NEUE_FAMILY}`) return;
      fontStatus = { state: "loading", family, loadedBytes, totalBytes };
      render();
    },
  })
    .then(() => {
      loadedFontKey = key;
      fontStatus = { state: "ready", family };
      render();
    })
    .catch((error) => {
      console.error(`Failed to load font "${family}":`, error);
      fontStatus = { state: "error", family };
      render();
    });
}

/**
 * Puts the share link (SPEC.md story 61) on the clipboard when available,
 * falling back to updating the visible URL hash so the maker can copy it
 * manually (e.g. insecure context / clipboard permission denied).
 */
function copyShareLink(url) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => {
      window.location.hash = url.slice(url.indexOf("#") + 1);
    });
  } else {
    window.location.hash = url.slice(url.indexOf("#") + 1);
  }
}

render();
