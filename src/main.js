import "./controls/groups/index.js"; // registers all control groups (side effect)
import { computeLayout } from "./engine/computeLayout.js";
import { createBrowserEnv } from "./engine/createBrowserEnv.js";
import { defaultState } from "./engine/defaultState.js";
import { renderControls } from "./controls/renderControls.js";
import { renderSvgPreview } from "./render/renderSvgPreview.js";
import "./style.css";

/**
 * App wiring for issue #2: text box → live preview of bordered cards on an
 * SVG page (Grid, uniform). The single ProjectState drives everything —
 * controls return a new state, `computeLayout` turns it into geometry, and the
 * thin SVG renderer draws that geometry. Later slices (mat, playful letters,
 * other layout modes, fonts, PDF, projects) extend the same seam.
 */
let state = { ...defaultState(), text: "January February March" };
const env = createBrowserEnv();

const app = document.querySelector("#app");
app.innerHTML = `
  <h1>playprint</h1>
  <p>Type words below — every whitespace-separated token becomes a bordered cut-out card.</p>
  <div id="controls"></div>
  <div id="preview"></div>
`;

const controlsEl = document.querySelector("#controls");
const previewEl = document.querySelector("#preview");

function render() {
  renderControls(controlsEl, state, (next) => {
    state = next;
    render();
  });

  const layoutResult = computeLayout(state, env);
  previewEl.replaceChildren(
    renderSvgPreview(layoutResult, {
      fontFamily: state.card?.font?.family,
      sizePt: state.card?.font?.sizePt,
      textColor: state.card?.textColor,
    }),
  );
}

render();
