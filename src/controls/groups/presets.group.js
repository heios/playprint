import { registerControlGroup } from "../registry.js";

/**
 * Preset buttons that fill the text box in one click (SPEC.md user stories
 * 4–6). Each preset is a `type: "button"` control whose `setValue(state)`
 * returns a new state with only `text` replaced — everything else is left
 * untouched, so the inserted text stays freely editable afterwards.
 *
 * Self-registers as its own group (new file + one barrel import), never by
 * editing a shared list — the registration seam from issue #1.
 */
const MONTHS =
  "January February March April May June July August September October November December";
const DIGITS = "0 1 1 2 2 3 4 5 6 7 8 9";

registerControlGroup({
  id: "presets",
  label: "Presets",
  controls: [
    {
      id: "months",
      label: "Months",
      type: "button",
      getValue: () => "January … December",
      setValue: (state) => ({ ...state, text: MONTHS }),
    },
    {
      id: "digits",
      label: "Digits",
      type: "button",
      getValue: () => "0 1 1 2 …",
      setValue: (state) => ({ ...state, text: DIGITS }),
    },
  ],
});
