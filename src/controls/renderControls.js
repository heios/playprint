import { getRegisteredControlGroups } from "./registry.js";

/**
 * Thin DOM renderer over the control registry. Deliberately dumb: it only
 * knows how to turn a `ControlGroupDef` into DOM, it has no knowledge of
 * *which* groups exist. New groups appear here automatically once they
 * self-register (see `./groups/index.js`) — this file never changes when a
 * group is added.
 *
 * Reconciles in place rather than tearing the panel down on every call
 * (issue #23A). The app's render loop calls `renderControls` again on every
 * `onChange` — including the `input` events a slider fires continuously
 * while being dragged. A naive `container.replaceChildren()` here used to
 * detach the very `<input type="range">` the pointer was dragging, which
 * both lost pointer capture (drag died after one step) and would have
 * fought any live focus/caret in a text control. Instead: when the set of
 * rendered groups/controls has the same shape as last time (the overwhelmingly
 * common case — a value changed, not the control set), existing DOM nodes are
 * reused and only their *value* is refreshed; nodes are only created/removed
 * when a control's visibility actually changes.
 *
 * Not unit-tested against DOM *structure* in general (SPEC.md "Testing
 * Decisions": assert external engine behaviour, not DOM structure) — but the
 * reconciliation behaviour itself (identity survives a re-render; readout
 * tracks the value) is exactly the externally-observable contract issue #23
 * asks for, so it IS covered (`__tests__/renderControls.test.js`).
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
  const visibleGroups = getRegisteredControlGroups().filter((group) => !group.isVisible || group.isVisible(state));

  // Reuse a per-container map of already-built control/group nodes across
  // calls, so a control that already exists keeps its DOM identity (and
  // therefore its live drag/focus) instead of being recreated.
  const registryCache = (container.__ppControlCache ??= new Map());

  // Once-attached listeners (see `renderControl` below) must never close
  // over the `state`/`onChange` that were live at node-CREATION time —
  // reconciliation means a control's `<input>`/`<button>` can survive many
  // renders, and each of those renders may carry a *different* `state`
  // (e.g. a sibling control just changed a field this control doesn't own).
  // A closure captured once would keep firing `setValue` against that first
  // stale snapshot forever, silently reverting every field any other
  // control had since changed. Instead, listeners are written once but read
  // `state`/`onChange` off this shared mutable ref, which every render call
  // refreshes to the current values before doing anything else — so a
  // listener firing on render #50 always sees render #50's `state`.
  const live = (container.__ppControlLive ??= { state, onChange });
  live.state = state;
  live.onChange = onChange;

  const seenKeys = new Set();
  let previousFieldset = null;

  for (const group of visibleGroups) {
    const visibleControls = group.controls.filter((control) => !control.isVisible || control.isVisible(state));

    let entry = registryCache.get(group.id);
    if (!entry || entry.type !== "group") {
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = group.label;
      fieldset.appendChild(legend);
      entry = { type: "group", fieldset, controls: new Map() };
      registryCache.set(group.id, entry);
    }
    seenKeys.add(group.id);

    // Keep the fieldset in the right document position/order without
    // rebuilding it. Only actually move it if it isn't already there —
    // re-inserting a node that already occupies that slot is a same-position
    // no-op in the DOM, but it can still drop focus/selection on a live
    // descendant in some engines, so it's avoided rather than relied on.
    const desiredAfter = previousFieldset ? previousFieldset.nextSibling : container.firstChild;
    if (desiredAfter !== entry.fieldset) {
      container.insertBefore(entry.fieldset, desiredAfter);
    }
    previousFieldset = entry.fieldset;

    const seenControlKeys = new Set();
    let previousControlNode = entry.fieldset.querySelector("legend");
    for (const control of visibleControls) {
      let controlEntry = entry.controls.get(control.id);
      if (!controlEntry || controlEntry.control.type !== control.type) {
        const node = renderControl(control, live, extra);
        controlEntry = { control, node };
        entry.controls.set(control.id, controlEntry);
      } else if (control.type === "button") {
        // Stateless action: nothing to sync (its label doesn't depend on
        // `state`), and rebuilding would only cost a listener churn. Its
        // click listener (attached once, in `renderControl`) reads `live`
        // on each click, so it still sees whatever `state` is current.
        controlEntry.control = control;
      } else if (control.type === "font-picker") {
        // No live drag/focus lives inside a font-picker (it's buttons + a
        // progress bar), so it's safe/simplest to rebuild its content in
        // place on every render — this is how it picks up async font-load
        // progress (`extra.fontStatus`) and newly-selected options without
        // needing a value-sync path of its own (issue #23A only demands DOM
        // identity survive for controls that can have an in-flight
        // drag/keystroke, which a font-picker never does).
        controlEntry.control = control;
        const freshNode = renderControl(control, live, extra);
        controlEntry.node.replaceWith(freshNode);
        controlEntry.node = freshNode;
      } else {
        controlEntry.control = control;
        updateControl(controlEntry.node, control, state);
      }
      seenControlKeys.add(control.id);

      const desiredControlAfter = previousControlNode ? previousControlNode.nextSibling : entry.fieldset.firstChild;
      if (desiredControlAfter !== controlEntry.node) {
        entry.fieldset.insertBefore(controlEntry.node, desiredControlAfter);
      }
      previousControlNode = controlEntry.node;
    }

    // Drop controls that are no longer visible for this state.
    for (const [id, controlEntry] of entry.controls) {
      if (!seenControlKeys.has(id)) {
        controlEntry.node.remove();
        entry.controls.delete(id);
      }
    }
  }

  // Drop groups that are no longer visible for this state.
  for (const [id, entry] of registryCache) {
    if (!seenKeys.has(id)) {
      entry.fieldset.remove();
      registryCache.delete(id);
    }
  }
}

/**
 * Builds a control's DOM node and attaches its listeners exactly once —
 * reconciliation (see `renderControls` above) means this node, and these
 * listeners, can outlive many subsequent renders. Every listener therefore
 * reads the current `state`/`onChange` off `live` (a mutable ref that
 * `renderControls` refreshes on every call) rather than closing over the
 * `state`/`onChange` that happened to be live when the listener was
 * attached — otherwise a listener would keep applying `setValue` against
 * whatever `state` existed at creation time forever, clobbering any field
 * another control changed since.
 *
 * @param {object} control
 * @param {{ state: object, onChange: (next: object) => void }} live
 * @param {object} extra
 */
function renderControl(control, live, extra) {
  // A preset "button" is an action, not a bound input: click applies setValue.
  if (control.type === "button") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = control.label;
    button.addEventListener("click", () => live.onChange(control.setValue(live.state)));
    return button;
  }

  if (control.type === "font-picker") {
    return renderFontPicker(control, live, extra.fontStatus);
  }

  const label = document.createElement("label");
  const input = createInput(control, live.state);

  if (control.type === "slider") {
    // Live value readout beside the label (issue #23B — the prototype had
    // this; the shipped panel dropped it). Purely additive: no change to
    // the control-registration API, it just reads `control.getValue`.
    const labelRow = document.createElement("span");
    labelRow.className = "pp-label-row";

    const labelText = document.createElement("span");
    labelText.className = "pp-label-text";
    labelText.textContent = control.label;
    labelRow.appendChild(labelText);

    const readout = document.createElement("output");
    readout.className = "slider-readout";
    readout.textContent = input.value;
    labelRow.appendChild(readout);

    label.appendChild(labelRow);
    input.addEventListener("input", () => {
      readout.textContent = input.value;
    });
  } else {
    label.appendChild(document.createTextNode(control.label));
  }

  const eventName = control.type === "select" || control.type === "toggle" ? "change" : "input";
  input.addEventListener(eventName, (event) => {
    const value = control.type === "toggle" ? event.target.checked : event.target.value;
    live.onChange(control.setValue(live.state, value));
  });

  label.appendChild(input);
  return label;
}

/**
 * Refreshes an already-built control node's *value* in place (issue #23A) —
 * never recreates the `<input>`, so an in-progress drag/focus survives a
 * re-render triggered by this very control's own `input` event, or by a
 * sibling control changing. Only called for slider/toggle/select/text/
 * number/color controls; `button` and `font-picker` are handled by their own
 * branches in the caller (see `renderControls`), since neither has an
 * `<input>`-shaped value to sync this way.
 */
function updateControl(node, control, state) {
  const input = node.querySelector("input, textarea, select");
  if (!input) return;

  // Don't clobber a value the maker is actively editing/dragging: only sync
  // when the DOM doesn't already reflect the latest value (e.g. a re-render
  // triggered by an unrelated control). This also protects focus/caret in
  // text inputs, since setting `.value` to its current value is a no-op but
  // setting it while focused with a *different* value would move the caret.
  if (document.activeElement === input) return;

  const value = control.getValue(state);
  if (control.type === "toggle") {
    input.checked = Boolean(value);
  } else if (control.type === "select") {
    input.value = value;
  } else {
    const next = control.type === "slider" || control.type === "number" ? String(value ?? 0) : (value ?? "");
    if (input.value !== next) input.value = next;
  }

  if (control.type === "slider") {
    const readout = node.querySelector(".slider-readout");
    if (readout) readout.textContent = input.value;
  }
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
function renderFontPicker(control, live, fontStatus) {
  const wrapper = document.createElement("div");
  wrapper.className = "font-picker";

  const heading = document.createElement("span");
  heading.textContent = control.label;
  wrapper.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "font-picker-grid";

  const current = control.getValue(live.state);
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

    button.addEventListener("click", () =>
      live.onChange(control.setValue(live.state, { family: option.family, source: option.source })),
    );
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
