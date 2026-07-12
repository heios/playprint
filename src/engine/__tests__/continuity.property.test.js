import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";
import { makeState } from "./testState.js";

/**
 * Issue #3 core invariants (SPEC.md "Seeded continuity" + "Testing":
 * continuity, cut-line containment, determinism), all property-based.
 */
const env = createStubEnv({ charWidthMm: 5 });

function allCards(result) {
  return result.pages.flatMap((p) => p.cards);
}

const STYLES = ["random", "wave", "alternating", "smile"];
const word = fc.stringMatching(/^[a-z]{1,8}$/);
const words = fc.array(word, { minLength: 1, maxLength: 6 }).map((w) => w.join(" "));

/** The absolute corners of a glyph's rotated bounding box, in page mm. */
function glyphRotatedCorners(g, charWidthMm, runHeightMm, ascentMm) {
  // Glyph box before rotation: left = g.x, baseline = g.y, ascent above, descent below.
  const left = g.x;
  const right = g.x + charWidthMm;
  const top = g.y - ascentMm;
  const bottom = g.y + (runHeightMm - ascentMm);
  const cx = g.x;
  const cy = g.y; // engine rotates each glyph about its baseline-left origin
  const rad = (g.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ].map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

describe("continuity: small amount change → small change everywhere", () => {
  it("nudging any letter amount moves every glyph only a little", () => {
    fc.assert(
      fc.property(words, fc.constantFrom(...STYLES), fc.integer({ min: 1, max: 999 }), (text, style, seed) => {
        const base = makeState({ text, seed, letters: { style, rotationDeg: 10, verticalMm: 4, horizontalJitterMm: 3 } });
        const nudged = makeState({ text, seed, letters: { style, rotationDeg: 10.5, verticalMm: 4.2, horizontalJitterMm: 3.1 } });

        const a = allCards(computeLayout(base, env));
        const b = allCards(computeLayout(nudged, env));
        expect(a.length).toBe(b.length);

        for (let ci = 0; ci < a.length; ci++) {
          const ga = a[ci].glyphs;
          const gb = b[ci].glyphs;
          expect(ga.length).toBe(gb.length);
          // Measure the SEEDED playful motion in the card's own frame (glyph
          // relative to its inner-border origin), so the assertion isolates the
          // continuity of the transform from the auto-grow footprint reflow that
          // an amount change legitimately (and continuously) causes.
          for (let gi = 0; gi < ga.length; gi++) {
            const dLocalX = gb[gi].x - b[ci].innerRect.xMm - (ga[gi].x - a[ci].innerRect.xMm);
            const dLocalY = gb[gi].y - b[ci].innerRect.yMm - (ga[gi].y - a[ci].innerRect.yMm);
            expect(Math.abs(dLocalX)).toBeLessThan(1);
            expect(Math.abs(dLocalY)).toBeLessThan(1);
            expect(Math.abs(gb[gi].rotationDeg - ga[gi].rotationDeg)).toBeLessThan(2);
          }
        }
      }),
    );
  });

  it("per-card tilt/shift move continuously with their amounts", () => {
    fc.assert(
      fc.property(words, fc.integer({ min: 1, max: 999 }), (text, seed) => {
        const a = allCards(computeLayout(makeState({ text, seed, card: { rotationDeg: 8, offsetMm: 3 } }), env));
        const b = allCards(computeLayout(makeState({ text, seed, card: { rotationDeg: 8.3, offsetMm: 3.2 } }), env));
        for (let i = 0; i < a.length; i++) {
          expect(Math.abs((b[i].tiltDeg ?? 0) - (a[i].tiltDeg ?? 0))).toBeLessThan(1);
          expect(Math.abs(b[i].innerRect.xMm - a[i].innerRect.xMm)).toBeLessThan(1);
          expect(Math.abs(b[i].innerRect.yMm - a[i].innerRect.yMm)).toBeLessThan(1);
        }
      }),
    );
  });
});

describe("cut-line containment under any playful amounts", () => {
  it("no rotated glyph crosses the inner border for any style/amount", () => {
    fc.assert(
      fc.property(
        words,
        fc.constantFrom(...STYLES),
        fc.integer({ min: 1, max: 999 }),
        fc.double({ min: 0, max: 45, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 8, noNaN: true }),
        (text, style, seed, rotationDeg, verticalMm, horizontalJitterMm) => {
          const state = makeState({
            text,
            seed,
            letters: { style, rotationDeg, verticalMm, horizontalJitterMm, waveFrequency: 2 },
          });
          const result = computeLayout(state, env);
          // Recover the metrics the engine used, per token.
          for (const card of allCards(result)) {
            const token = card.glyphs.map((g) => g.char).join("");
            const { heightMm: runHeightMm, ascentMm } = env.measureText(token, { sizePt: 24 });
            const charWidthMm = card.glyphs.length ? env.measureText(token, { sizePt: 24 }).widthMm / card.glyphs.length : 0;
            const r = card.innerRect;
            const minX = r.xMm;
            const maxX = r.xMm + r.widthMm;
            const minY = r.yMm;
            const maxY = r.yMm + r.heightMm;
            for (const g of card.glyphs) {
              for (const [x, y] of glyphRotatedCorners(g, charWidthMm, runHeightMm, ascentMm)) {
                expect(x).toBeGreaterThanOrEqual(minX - 1e-6);
                expect(x).toBeLessThanOrEqual(maxX + 1e-6);
                expect(y).toBeGreaterThanOrEqual(minY - 1e-6);
                expect(y).toBeLessThanOrEqual(maxY + 1e-6);
              }
            }
          }
        },
      ),
    );
  });
});

describe("determinism with playful transforms", () => {
  it("same state → structurally identical LayoutResult", () => {
    fc.assert(
      fc.property(words, fc.constantFrom(...STYLES), fc.integer(), (text, style, seed) => {
        const state = makeState({
          text,
          seed,
          card: { rotationDeg: 10, offsetMm: 4 },
          letters: { style, rotationDeg: 15, verticalMm: 5, horizontalJitterMm: 3 },
        });
        expect(computeLayout(state, env)).toEqual(computeLayout(state, env));
      }),
    );
  });
});
