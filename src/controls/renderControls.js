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
 */
export function renderControls(container, state, onChange) {
  container.replaceChildren();

  for (const group of getRegisteredControlGroups()) {
    if (group.isVisible && !group.isVisible(state)) continue;

    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.label;
    fieldset.appendChild(legend);

    for (const control of group.controls) {
      if (control.isVisible && !control.isVisible(state)) continue;
      fieldset.appendChild(renderControl(control, state, onChange));
    }

    container.appendChild(fieldset);
  }
}

function renderControl(control, state, onChange) {
  // A preset "button" is an action, not a bound input: click applies setValue.
  if (control.type === "button") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = control.label;
    button.addEventListener("click", () => onChange(control.setValue(state)));
    return button;
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
  } else {
    el.type = "text";
    el.value = value ?? "";
  }
  return el;
}
