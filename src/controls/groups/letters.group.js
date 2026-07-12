import { registerControlGroup } from "../registry.js";

/**
 * Playful-letter controls (SPEC.md user stories 29–33, 35): the letter STYLE
 * plus the amount sliders that scale the seeded motion. Progressive disclosure
 * (story: "style-specific controls appear only for the active style") is done
 * with per-control `isVisible` guards — horizontal jitter shows only for
 * Random, wave frequency only for Wave. Each reads/writes its slice of
 * `state.letters` purely.
 *
 * Self-registered group (new file + one barrel import) — never by editing a
 * shared list.
 */
registerControlGroup({
  id: "letters",
  label: "Playful letters",
  controls: [
    {
      id: "letter-style",
      label: "Letter style",
      type: "select",
      options: ["random", "wave", "alternating", "smile"],
      getValue: (state) => state.letters?.style ?? "random",
      setValue: (state, value) => setLetters(state, { style: value }),
    },
    {
      id: "letter-rotation",
      label: "Rotation amount (°)",
      type: "slider",
      max: 45,
      getValue: (state) => state.letters?.rotationDeg ?? 0,
      setValue: (state, value) => setLetters(state, { rotationDeg: num(value) }),
    },
    {
      id: "letter-vertical",
      label: "Vertical offset (mm)",
      type: "slider",
      max: 15,
      getValue: (state) => state.letters?.verticalMm ?? 0,
      setValue: (state, value) => setLetters(state, { verticalMm: num(value) }),
    },
    {
      id: "letter-horizontal",
      label: "Horizontal jitter (mm)",
      type: "slider",
      max: 10,
      // Random style only (progressive disclosure).
      isVisible: (state) => (state.letters?.style ?? "random") === "random",
      getValue: (state) => state.letters?.horizontalJitterMm ?? 0,
      setValue: (state, value) => setLetters(state, { horizontalJitterMm: num(value) }),
    },
    {
      id: "wave-frequency",
      label: "Wave frequency (cycles)",
      type: "slider",
      min: 0.5,
      max: 5,
      step: 0.5,
      // Wave style only (progressive disclosure).
      isVisible: (state) => (state.letters?.style ?? "random") === "wave",
      getValue: (state) => state.letters?.waveFrequency ?? 1,
      setValue: (state, value) => setLetters(state, { waveFrequency: num(value) }),
    },
  ],
});

function setLetters(state, patch) {
  return { ...state, letters: { ...state.letters, ...patch } };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
