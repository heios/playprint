import { registerControlGroup } from "../registry.js";
import { COMIC_NEUE_FAMILY } from "../../fonts/comicNeue.js";
import { CURATED_FONTS } from "../../fonts/curatedFonts.js";

/**
 * Font controls (SPEC.md user stories 47–51 / issue #7): the picker showing
 * Comic Neue (offline default) plus the curated set as instant PNG
 * thumbnails, a free-text field for any Google Font by family name, and the
 * size/letter-spacing sliders. Purely declarative like every other group —
 * `getValue`/`setValue` only read/write `state.card.font`; the actual
 * fetch/decode/progress work happens in `main.js`'s font-loading wiring
 * (SPEC.md: "network kept out of the pure engine"), triggered when
 * `setValue` picks a new family.
 *
 * The `type: "font-picker"` control is a new, generic control TYPE (thumbnail
 * grid + radio-style selection), rendered by `renderControls.js` alongside
 * the existing slider/select/etc. types — not a one-off DOM special case, so
 * a later group could reuse it. `options` carries the curated font metadata
 * (family + thumbnail) the renderer needs to draw each choice.
 *
 * Self-registered group (new file + one barrel import) — no shared list.
 */
registerControlGroup({
  id: "font",
  label: "Font",
  controls: [
    {
      id: "font-picker",
      label: "Choose a font",
      type: "font-picker",
      // Builtin first (always instant/offline), then curated (instant
      // thumbnail, fetches on selection) - SPEC.md stories 47-49.
      options: [
        { family: COMIC_NEUE_FAMILY, source: "builtin", thumbnailDataUri: null },
        ...CURATED_FONTS.map((f) => ({ family: f.family, source: "curated", thumbnailDataUri: f.thumbnailDataUri })),
      ],
      getValue: (state) => ({
        family: state.card?.font?.family ?? COMIC_NEUE_FAMILY,
        source: state.card?.font?.source ?? "builtin",
      }),
      setValue: (state, value) => setFont(state, { family: value.family, source: value.source }),
    },
    {
      id: "font-custom",
      label: "Or type any Google Font name",
      type: "text",
      getValue: (state) => (state.card?.font?.source === "custom" ? (state.card?.font?.family ?? "") : ""),
      setValue: (state, value) => setFont(state, { family: value, source: "custom" }),
    },
    {
      id: "font-size",
      label: "Font size (pt)",
      type: "slider",
      min: 8,
      max: 120,
      step: 1,
      getValue: (state) => state.card?.font?.sizePt ?? 24,
      setValue: (state, value) => setFont(state, { sizePt: num(value) }),
    },
    {
      id: "letter-spacing",
      label: "Letter spacing (mm)",
      type: "slider",
      min: 0,
      max: 10,
      step: 0.1,
      getValue: (state) => state.card?.font?.letterSpacingMm ?? 0,
      setValue: (state, value) => setFont(state, { letterSpacingMm: num(value) }),
    },
  ],
});

function setFont(state, patch) {
  return { ...state, card: { ...state.card, font: { ...state.card?.font, ...patch } } };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
