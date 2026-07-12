import "./controls/groups/index.js"; // registers all control groups (side effect)
import { computeLayout } from "./engine/computeLayout.js";
import { createBrowserEnv } from "./engine/createBrowserEnv.js";
import { renderControls } from "./controls/renderControls.js";
import { renderSvgPreview } from "./render/renderSvgPreview.js";
import "./style.css";

/**
 * Placeholder wiring for issue #1: proves the seam end-to-end (state →
 * computeLayout → SVG preview, controls → state) with no product behaviour
 * yet. Later slices replace the state shape and pass internals; this file's
 * job is only to prove the pieces connect.
 */
let state = { schemaVersion: 1, text: "", seed: 1 };
const env = createBrowserEnv();

const app = document.querySelector("#app");
app.innerHTML = `
  <h1>playprint</h1>
  <p>Scaffold: pipeline engine + control-registration seam (issue #1). No product behaviour yet.</p>
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
  previewEl.replaceChildren(renderSvgPreview(layoutResult));
}

render();
