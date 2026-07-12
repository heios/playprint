import { describe, expect, it } from "vitest";
import fc from "fast-check";
import LZString from "lz-string";
import { encodeState, decodeState, CURRENT_SCHEMA_VERSION } from "../serializeState.js";
import { defaultState } from "../../engine/defaultState.js";
import { makeState } from "../../engine/__tests__/testState.js";

/**
 * Issue #9 (SPEC.md "Secondary seam — state serialization"): `encode`/`decode`
 * are pure functions over `ProjectState` — compact JSON + LZ-compression, so
 * URL-share and localStorage projects are a thin layer over the exact same
 * round-trip. No DOM/network/storage here; that's what makes this seam
 * testable without a browser.
 */
describe("serializeState", () => {
  it("round-trips the default state: decode(encode(state)) deep-equals state", () => {
    const state = defaultState();
    const payload = encodeState(state);
    expect(decodeState(payload)).toEqual(state);
  });

  it("round-trips a state with every branch customized", () => {
    const state = makeState({
      name: "Birthday cards",
      text: "January\nFebruary March\n\n1 1 2 2",
      seed: 42,
      page: { size: "B2", orientation: "landscape", marginMm: 22 },
      layout: {
        mode: "random",
        cardSizing: "fit",
        gapMm: 7.5,
        rowAlign: "left",
        grid: { columns: 4 },
        random: { rotationDeg: 12, shiftMm: 6 },
      },
      card: {
        font: { family: "Schoolbell", source: "curated", sizePt: 36, letterSpacingMm: 1.2 },
        textColor: "#ff00aa",
        paddingMm: 6,
        offsetMm: 3,
        rotationDeg: 8,
        inner: { color: "#123456", strokeMm: 0.8, radiusMm: 2, visible: true },
        outer: {
          enabled: true,
          color: "#ff5aa5",
          strokeMm: 1,
          radiusMm: 3,
          matPercent: 30,
          minClearanceMm: 3,
          balanceRatio: 1.5,
        },
      },
      letters: {
        style: "wave",
        rotationDeg: 15,
        verticalMm: 2,
        horizontalJitterMm: 1,
        waveFrequency: 2,
      },
      visibility: { outer: false, inner: true, text: true },
    });

    const payload = encodeState(state);
    expect(decodeState(payload)).toEqual(state);
  });

  it("round-trips a custom Google Font by family name (font travels as family name, not bytes)", () => {
    const state = makeState({ card: { font: { family: "Baloo 2", source: "custom", sizePt: 30, letterSpacingMm: 0 } } });
    const payload = encodeState(state);
    const decoded = decodeState(payload);
    expect(decoded.card.font).toEqual({ family: "Baloo 2", source: "custom", sizePt: 30, letterSpacingMm: 0 });
  });

  it("writes the current schemaVersion when encoding", () => {
    const state = defaultState();
    const payload = encodeState(state);
    const decoded = decodeState(payload);
    expect(decoded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("produces a URL-safe compact string payload (no raw JSON leaking through)", () => {
    const state = defaultState();
    const payload = encodeState(state);
    expect(typeof payload).toBe("string");
    expect(payload.length).toBeGreaterThan(0);
    // Must not contain characters that need percent-encoding in a URL hash.
    expect(payload).toMatch(/^[A-Za-z0-9+/=_-]+$/);
    // Should not just be the raw JSON re-encoded (i.e. compression is doing something).
    expect(payload).not.toContain('"schemaVersion"');
  });

  it("keeps the payload compact even for very long text (compression, not raw JSON)", () => {
    const longText = Array.from({ length: 500 }, (_, i) => `Word${i}`).join(" ");
    const state = makeState({ text: longText });
    const payload = encodeState(state);
    const rawJsonLength = JSON.stringify(state).length;
    expect(payload.length).toBeLessThan(rawJsonLength);
    expect(decodeState(payload).text).toBe(longText);
  });

  it("migrates an old schemaVersion payload forward (unknown fields backfilled from defaults)", () => {
    // Simulate a v1 payload missing a field a later schema version might add,
    // by encoding a state that is missing `layout.random` entirely under an
    // older version number, then decoding.
    const legacy = { ...defaultState(), schemaVersion: 1 };
    delete legacy.layout.random;
    const payload = encodeState(legacy);
    const decoded = decodeState(payload);
    expect(decoded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(decoded.layout.random).toEqual(defaultState().layout.random);
  });

  it("throws a clear error decoding garbage / corrupted payloads instead of crashing silently", () => {
    expect(() => decodeState("not-a-real-payload-!!!")).toThrow();
    expect(() => decodeState("")).toThrow();
  });

  it("throws decoding a payload from a newer, unsupported schemaVersion", () => {
    // Build the "future" payload directly (bypassing encodeState, which
    // always stamps the CURRENT version) to simulate a payload minted by a
    // later build of this app.
    const futureJson = JSON.stringify({ ...defaultState(), schemaVersion: CURRENT_SCHEMA_VERSION + 1000 });
    const future = LZString.compressToEncodedURIComponent(futureJson);
    expect(() => decodeState(future)).toThrow();
  });

  it("is deterministic: encoding the same state twice yields the same payload", () => {
    const state = makeState({ text: "January February" });
    expect(encodeState(state)).toBe(encodeState(state));
  });

  it("round-trip property: decode(encode(state)) deep-equals state for arbitrary text/name/numeric fields", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        fc.string({ maxLength: 60 }),
        fc.integer({ min: 0, max: 999999 }),
        fc.integer({ min: 8, max: 120 }),
        (text, name, seed, sizePt) => {
          const state = makeState({ text, name, seed, card: { font: { sizePt } } });
          const payload = encodeState(state);
          expect(decodeState(payload)).toEqual(state);
        },
      ),
      { numRuns: 50 },
    );
  });
});
