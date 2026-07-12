import { registerControlGroup } from "../registry.js";

/**
 * Example registered control group — proves the registration pattern for
 * issue #1. A later slice adding, say, the "Outer mat" group copies this
 * file's shape: import `registerControlGroup`, describe one cohesive
 * cluster of controls, call it once at module load. Nothing here needs to
 * be added to any shared list.
 *
 * Corresponds to SPEC.md `state.text` (user stories 1–9: the token source
 * box) — kept intentionally small for the scaffold; full preset buttons
 * (Months/Digits) are a later slice's concern.
 */
registerControlGroup({
  id: "text",
  label: "Text",
  controls: [
    {
      id: "text",
      label: "Words",
      type: "text",
      getValue: (state) => state.text ?? "",
      setValue: (state, value) => ({ ...state, text: value }),
    },
  ],
});
