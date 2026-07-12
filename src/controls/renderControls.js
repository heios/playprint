import { getRegisteredControlGroups } from "./registry.js";

/**
 * Thin DOM renderer over the control registry. Deliberately dumb: it only
 * knows how to turn a `ControlGroupDef` into DOM, it has no knowledge of
 * *which* groups exist. New groups appear here automatically once they
 * self-register (see `./groups/index.js`) — this file never changes when a
 * group is added.
 *
 * Not unit-tested against the DOM (SPEC.md "Testing Decisions": assert
 * external engine behaviour, not DOM structure) — the registry itself
 * carries the tested contract.
 *
 * @param {HTMLElement} container
 * @param {object} state current ProjectState
 * @param {(next: object) => void} onChange called with a new state whenever
 *   any control changes.
 * @param {{ fontStatus?: { state: "idle"|"loading"|"ready"|"error", loadedBytes?: number, totalBytes?: number|null } }} [extra]
 *   Transient, non-persisted UI state a control may want to reflect (e.g. the
 *   font-picker's download progress — SPEC.md: "fetched on selection with a
 *   determinate progress bar"). Kept OUT of `ProjectState` because it is a
 *   loading-in-flight fact, not a project setting.
 */
export function renderControls(container, state, onChange, extra = {}) {
  container.replaceChildren();

  for (const group of getRegisteredControlGroups()) {
    if (group.isVisible && !group.isVisible(state)) continue;

    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.label;
    fieldset.appendChild(legend);

    for (const control of group.controls) {
      if (control.isVisible && !control.isVisible(state)) continue;
      fieldset.appendChild(renderControl(control, state, onChange, extra));
    }

    container.appendChild(fieldset);
  }
}

function renderControl(control, state, onChange, extra) {
  // A preset "button" is an action, not a bound input: click applies setValue.
  if (control.type === "button") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = control.label;
    button.addEventListener("click", () => onChange(control.setValue(state)));
    return button;
  }

  if (control.type === "font-picker") {
    return renderFontPicker(control, state, onChange, extra.fontStatus);
  }

  const label = document.createElement("label");
  label.textContent = control.label;

  const input = createInput(control, state);
  const eventName = control.type === "select" || control.type === "toggle" ? "change" : "input";
  input.addEventListener(eventName, (event) => {
    const value = control.type === "toggle" ? event.target.checked : event.target.value;
    onChange(control.setValue(state, value));
  });

  label.appendChild(input);
  return label;
}

function createInput(control, state) {
  const value = control.getValue(state);

  if (control.type === "text") {
    const el = document.createElement("textarea");
    el.value = value ?? "";
    return el;
  }

  if (control.type === "select") {
    const el = document.createElement("select");
    for (const option of control.options ?? []) {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      if (option === value) opt.selected = true;
      el.appendChild(opt);
    }
    return el;
  }

  const el = document.createElement("input");
  if (control.type === "toggle") {
    el.type = "checkbox";
    el.checked = Boolean(value);
  } else if (control.type === "color") {
    el.type = "color";
    el.value = value ?? "#000000";
  } else if (control.type === "slider") {
    el.type = "range";
    el.min = String(control.min ?? 0);
    el.max = String(control.max ?? 40);
    el.step = String(control.step ?? 0.5);
    el.value = String(value ?? 0);
  } else if (control.type === "number") {
    el.type = "number";
    if (control.min != null) el.min = String(control.min);
    if (control.max != null) el.max = String(control.max);
    if (control.step != null) el.step = String(control.step);
    el.value = String(value ?? 0);
  } else {
    el.type = "text";
    el.value = value ?? "";
  }
  return el;
}

/**
 * The font-picker control: a grid of radio-style thumbnail buttons (SPEC.md
 * story 47 — "a sample image of each font instantly, before any load") plus
 * a determinate progress bar for whichever font is currently loading
 * (SPEC.md story 49). Builtin (Comic Neue) has no thumbnail image — it draws
 * its own label since it needs no fetch and is always instantly available.
 */
function renderFontPicker(control, state, onChange, fontStatus) {
  const wrapper = document.createElement("div");
  wrapper.className = "font-picker";

  const heading = document.createElement("span");
  heading.textContent = control.label;
  wrapper.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "font-picker-grid";

  const current = control.getValue(state);
  for (const option of control.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "font-picker-option";
    button.setAttribute("aria-pressed", String(option.family === current.family));
    if (option.family === current.family) button.classList.add("selected");

    if (option.thumbnailDataUri) {
      const img = document.createElement("img");
      img.src = option.thumbnailDataUri;
      img.alt = option.family;
      button.appendChild(img);
    } else {
      const label = document.createElement("span");
      label.textContent = option.family;
      button.appendChild(label);
    }

    button.addEventListener("click", () => onChange(control.setValue(state, { family: option.family, source: option.source })));
    grid.appendChild(button);
  }
  wrapper.appendChild(grid);

  if (fontStatus && fontStatus.state === "loading") {
    wrapper.appendChild(renderProgressBar(fontStatus));
  } else if (fontStatus && fontStatus.state === "error") {
    const error = document.createElement("p");
    error.className = "font-picker-error";
    error.textContent = `Could not load "${fontStatus.family ?? current.family}" — try another font.`;
    wrapper.appendChild(error);
  }

  return wrapper;
}

function renderProgressBar({ loadedBytes = 0, totalBytes = null, family }) {
  const container = document.createElement("div");
  container.className = "font-picker-progress";

  const label = document.createElement("span");
  label.textContent = totalBytes
    ? `Loading ${family ?? "font"}… ${Math.round((loadedBytes / totalBytes) * 100)}%`
    : `Loading ${family ?? "font"}…`;
  container.appendChild(label);

  const progress = document.createElement("progress");
  progress.max = 1;
  if (totalBytes) {
    // Determinate: a real Content-Length-backed fraction (SPEC.md: "a
    // determinate progress bar (stream vs Content-Length)").
    progress.value = Math.min(1, loadedBytes / totalBytes);
  }
  // else: no `value` attribute -> the browser renders an indeterminate bar,
  // the honest fallback when Content-Length is unavailable.
  container.appendChild(progress);

  return container;
}
