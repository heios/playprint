/**
 * The canonical ProjectState the app boots with and tests build on — the
 * single object that drives rendering (SPEC.md "State object"). Kept as a
 * factory (not a shared frozen constant) so every caller gets its own
 * mutable-free copy and no two consumers alias nested objects.
 *
 * Issue #2 populates only the fields the "Grid, uniform, inner-border" slice
 * needs; later slices (mat, playful letters, random/flexible modes, fonts,
 * projects) fill in their own branches without changing these defaults.
 */
export function defaultState() {
  return {
    schemaVersion: 1,
    name: "Untitled",
    text: "",
    seed: 1,
    page: { size: "A4", orientation: "portrait", marginMm: 15 },
    layout: {
      mode: "grid",
      cardSizing: "uniform",
      gapMm: 4,
      rowAlign: "center",
      grid: { columns: "auto" },
    },
    card: {
      font: { family: "Comic Neue", source: "builtin", sizePt: 24, letterSpacingMm: 0 },
      textColor: "#000000",
      paddingMm: 4,
      // Per-card playful drift (seeded, continuous — SPEC.md stories 34–36).
      offsetMm: 0,
      rotationDeg: 0,
      inner: { color: "#000000", strokeMm: 0.5, radiusMm: 0, visible: true },
      // The optional second border (mat) behind each card (SPEC.md stories
      // 20–28). Disabled by default so the ticket-#2/#3 baseline is unchanged:
      // with `enabled: false` the outer border mirrors the inner and no float
      // happens. When enabled the inner floats inside a larger coloured mat,
      // clamped to satisfy `minClearanceMm` and `balanceRatio` (see passes/mat.js).
      outer: {
        enabled: false,
        color: "#ff5aa5",
        strokeMm: 0.5,
        radiusMm: 0,
        matPercent: 25, // mat margin as a % of the inner card's size
        minClearanceMm: 2, // hard floor: inner never closer than this to the outer
        balanceRatio: 2, // k: enforce max(cornerGap) < k·min(cornerGap)
      },
    },
    // Playful letter styling (SPEC.md stories 29–36). All amounts default to 0
    // so the ticket-#2 baseline (flat, centred text) is unchanged until a maker
    // dials playfulness up; every amount only SCALES a fixed seeded direction.
    letters: {
      style: "random",
      rotationDeg: 0,
      verticalMm: 0,
      horizontalJitterMm: 0, // random style only
      waveFrequency: 1, // wave style only (cycles per word)
    },
    // Per-print-pass layer visibility (SPEC.md stories 27–28): show just the
    // outer mat, the inner card, and/or the text for each matting pass. All on
    // by default so the full card renders until a maker isolates a layer.
    visibility: { outer: true, inner: true, text: true },
  };
}
