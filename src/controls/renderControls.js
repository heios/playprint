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

      const label = document.createElement("label");
      label.textContent = control.label;

      const input = document.createElement(control.type === "text" ? "textarea" : "input");
      if (control.type !== "text") input.type = control.type === "toggle" ? "checkbox" : "text";
      input.value = control.getValue(state);
      input.addEventListener("input", (event) => {
        onChange(control.setValue(state, event.target.value));
      });

      label.appendChild(input);
      fieldset.appendChild(label);
    }

    container.appendChild(fieldset);
  }
}
