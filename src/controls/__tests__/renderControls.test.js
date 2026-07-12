// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderControls } from "../renderControls.js";
import { _resetRegistryForTests, registerControlGroup } from "../registry.js";

/**
 * Issue #23: two pre-existing rendering bugs in the slider control.
 *
 * (A) `renderControls` used to unconditionally `container.replaceChildren()`
 * on every call, including the call triggered by a slider's own `input`
 * event. That tore the live `<input type="range">` out of the DOM mid-drag,
 * releasing pointer capture after a single step. Reconciling in place (or at
 * least not rebuilding on a same-shape re-render) keeps the dragged element
 * alive for the whole gesture.
 *
 * (B) The prototype showed each slider's live numeric value beside its
 * label; the shipped panel dropped it. This is a purely additive readout
 * that tracks the input's value on every `input` event.
 *
 * These tests exercise `renderControls` directly against the control-
 * registration seam (same pattern as `registry.test.js`), never touching the
 * engine.
 */
describe("renderControls — slider rendering (issue #23)", () => {
  afterEach(() => {
    _resetRegistryForTests();
  });

  function registerPaddingSlider() {
    registerControlGroup({
      id: "border",
      label: "Card border",
      controls: [
        {
          id: "padding",
          label: "Padding (mm)",
          type: "slider",
          min: 0,
          max: 40,
          step: 0.5,
          getValue: (state) => state.paddingMm ?? 4,
          setValue: (state, value) => ({ ...state, paddingMm: Number(value) }),
        },
      ],
    });
  }

  it("does not replace the controls container's children on a control input (A)", () => {
    registerPaddingSlider();

    const container = document.createElement("div");
    let state = { paddingMm: 4 };
    const onChange = vi.fn((next) => {
      state = next;
    });

    renderControls(container, state, onChange);

    const replaceChildrenSpy = vi.spyOn(container, "replaceChildren");
    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();

    slider.value = "10";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    // Re-rendering after the change (as main.js's render loop does) must not
    // tear down the container the live slider lives in.
    renderControls(container, state, onChange);
    expect(replaceChildrenSpy).not.toHaveBeenCalled();
  });

  it("keeps the SAME <input> node identity across a control input + re-render, so an in-flight drag survives (A)", () => {
    registerPaddingSlider();

    const container = document.createElement("div");
    let state = { paddingMm: 4 };
    const onChange = (next) => {
      state = next;
    };

    renderControls(container, state, onChange);
    const sliderBefore = container.querySelector('input[type="range"]');

    sliderBefore.value = "10";
    sliderBefore.dispatchEvent(new Event("input", { bubbles: true }));
    renderControls(container, state, onChange);

    const sliderAfter = container.querySelector('input[type="range"]');
    expect(sliderAfter).toBe(sliderBefore);
    expect(sliderAfter.value).toBe("10");
  });

  it("renders a live readout beside each slider showing its current value (B)", () => {
    registerPaddingSlider();

    const container = document.createElement("div");
    const state = { paddingMm: 4 };

    renderControls(container, state, () => {});

    const slider = container.querySelector('input[type="range"]');
    const label = slider.closest("label");
    const readout = label.querySelector("output, .slider-readout");
    expect(readout).toBeTruthy();
    expect(readout.textContent).toBe("4");
  });

  it("updates the readout live as the slider's input event fires (B)", () => {
    registerPaddingSlider();

    const container = document.createElement("div");
    let state = { paddingMm: 4 };
    const onChange = (next) => {
      state = next;
      renderControls(container, state, onChange);
    };

    renderControls(container, state, onChange);
    const slider = container.querySelector('input[type="range"]');
    const readoutBefore = slider.closest("label").querySelector("output, .slider-readout");
    expect(readoutBefore.textContent).toBe("4");

    slider.value = "17.5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    const sliderAfter = container.querySelector('input[type="range"]');
    const readoutAfter = sliderAfter.closest("label").querySelector("output, .slider-readout");
    expect(readoutAfter.textContent).toBe("17.5");
  });

  it("keeps a font-picker's progress bar in sync across re-renders (in-place reconcile must not skip it)", () => {
    registerControlGroup({
      id: "fonts",
      label: "Fonts",
      controls: [
        {
          id: "font",
          type: "font-picker",
          getValue: () => ({ family: "Comic Neue", source: "builtin" }),
          setValue: (state, value) => ({ ...state, font: value }),
          options: [{ family: "Comic Neue", source: "builtin" }],
        },
      ],
    });

    const container = document.createElement("div");
    const state = {};

    renderControls(container, state, () => {}, { fontStatus: { state: "idle" } });
    expect(container.querySelector(".font-picker-progress")).toBeNull();

    renderControls(container, state, () => {}, {
      fontStatus: { state: "loading", family: "Comic Neue", loadedBytes: 50, totalBytes: 100 },
    });
    expect(container.querySelector(".font-picker-progress")).toBeTruthy();
    expect(container.querySelector(".font-picker-progress progress").value).toBeCloseTo(0.5);
  });

  it("preserves an edit to one slider when a DIFFERENT slider is changed afterwards (stale-closure regression)", () => {
    // Reconciliation (issue #23A) means a control's <input> and its listener
    // are built ONCE and then reused across many renders. If that listener
    // captured `state`/`onChange` at creation time instead of reading the
    // current values, it would keep calling `setValue` against the
    // first-render snapshot forever — so editing Gap, then editing a
    // DIFFERENT control (Padding), would silently revert Gap back to its
    // original value the moment Padding's `{...state, paddingMm}` spread ran
    // against Padding's OWN stale snapshot. This drives the exact loop
    // main.js uses (`onChange` mutates the outer `state` and re-renders).
    registerControlGroup({
      id: "border",
      label: "Card border",
      controls: [
        {
          id: "gap",
          label: "Gap (mm)",
          type: "slider",
          min: 0,
          max: 40,
          step: 0.5,
          getValue: (state) => state.gapMm ?? 2,
          setValue: (state, value) => ({ ...state, gapMm: Number(value) }),
        },
        {
          id: "padding",
          label: "Padding (mm)",
          type: "slider",
          min: 0,
          max: 40,
          step: 0.5,
          getValue: (state) => state.paddingMm ?? 4,
          setValue: (state, value) => ({ ...state, paddingMm: Number(value) }),
        },
      ],
    });

    const container = document.createElement("div");
    let state = { gapMm: 2, paddingMm: 4 };
    function render() {
      renderControls(container, state, (next) => {
        state = next;
        render();
      });
    }
    render();

    const [gapInput, paddingInput] = container.querySelectorAll('input[type="range"]');

    gapInput.value = "10";
    gapInput.dispatchEvent(new Event("input", { bubbles: true }));

    // Re-query: reconciliation keeps identity, but querying fresh mirrors
    // what a real user interacting with the live DOM would touch.
    const paddingInputAfterGapEdit = container.querySelectorAll('input[type="range"]')[1];
    paddingInputAfterGapEdit.value = "20";
    paddingInputAfterGapEdit.dispatchEvent(new Event("input", { bubbles: true }));

    expect(state).toEqual({ gapMm: 10, paddingMm: 20 });
  });

  it("preserves a slider edit when a preset BUTTON is clicked afterwards (stale-closure regression)", () => {
    registerControlGroup({
      id: "border",
      label: "Card border",
      controls: [
        {
          id: "gap",
          label: "Gap (mm)",
          type: "slider",
          min: 0,
          max: 40,
          step: 0.5,
          getValue: (state) => state.gapMm ?? 2,
          setValue: (state, value) => ({ ...state, gapMm: Number(value) }),
        },
        {
          id: "resetPadding",
          label: "Reset padding",
          type: "button",
          // Real presets spread {...state}, exactly like this.
          setValue: (state) => ({ ...state, paddingMm: 99 }),
        },
      ],
    });

    const container = document.createElement("div");
    let state = { gapMm: 2, paddingMm: 4 };
    function render() {
      renderControls(container, state, (next) => {
        state = next;
        render();
      });
    }
    render();

    const gapInput = container.querySelector('input[type="range"]');
    gapInput.value = "10";
    gapInput.dispatchEvent(new Event("input", { bubbles: true }));

    const presetButton = container.querySelector("button");
    presetButton.dispatchEvent(new Event("click", { bubbles: true }));

    expect(state).toEqual({ gapMm: 10, paddingMm: 99 });
  });

  it("does not lose focus/caret in a text control while re-rendering after an unrelated change", () => {
    registerControlGroup({
      id: "text",
      label: "Text",
      controls: [
        {
          id: "label-text",
          label: "Label",
          type: "text",
          getValue: (state) => state.label ?? "",
          setValue: (state, value) => ({ ...state, label: value }),
        },
      ],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    let state = { label: "hello" };
    const onChange = (next) => {
      state = next;
    };

    renderControls(container, state, onChange);
    const textarea = container.querySelector("textarea");
    textarea.focus();
    textarea.setSelectionRange(2, 2);
    expect(document.activeElement).toBe(textarea);

    // Re-render with the SAME state/shape (as happens when an unrelated
    // control, e.g. a slider elsewhere in the panel, changes).
    renderControls(container, state, onChange);

    expect(document.activeElement).toBe(textarea);
    document.body.removeChild(container);
  });
});
