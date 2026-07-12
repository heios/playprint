import { describe, expect, it } from "vitest";
import { buildShareUrl, readStateFromHash } from "../shareUrl.js";
import { defaultState } from "../../engine/defaultState.js";
import { makeState } from "../../engine/__tests__/testState.js";

/**
 * Issue #9 (SPEC.md story 61-62): share-by-URL encodes the full
 * `ProjectState` into the hash fragment. Thin wrapper over
 * `serializeState.js` — these tests only cover the URL-shaping part (hash
 * present/absent, origin+path preserved, round-trip through a hash string),
 * not the encode/decode contract itself (covered in `serializeState.test.js`).
 */
describe("shareUrl", () => {
  it("builds a share URL that keeps the given origin+path and appends an encoded hash", () => {
    const state = makeState({ name: "Months", text: "January February" });
    const url = buildShareUrl("https://heios.github.io/playprint/", state);

    expect(url.startsWith("https://heios.github.io/playprint/#")).toBe(true);
    const hash = url.split("#")[1];
    expect(hash.length).toBeGreaterThan(0);
  });

  it("readStateFromHash decodes a hash produced by buildShareUrl back to the same state", () => {
    const state = makeState({ name: "Digits", text: "1 1 2 2", seed: 9 });
    const url = buildShareUrl("https://example.com/app/", state);
    const hash = url.split("#")[1];

    expect(readStateFromHash(hash)).toEqual(state);
  });

  it("readStateFromHash accepts a hash with or without a leading '#'", () => {
    const state = makeState({ text: "abc" });
    const url = buildShareUrl("https://example.com/", state);
    const hash = url.split("#")[1];

    expect(readStateFromHash(`#${hash}`)).toEqual(state);
    expect(readStateFromHash(hash)).toEqual(state);
  });

  it("readStateFromHash returns null for an empty/missing hash instead of throwing", () => {
    expect(readStateFromHash("")).toBeNull();
    expect(readStateFromHash("#")).toBeNull();
    expect(readStateFromHash(undefined)).toBeNull();
  });

  it("readStateFromHash returns null (not throw) for a corrupted hash", () => {
    expect(readStateFromHash("#not-a-valid-payload!!!")).toBeNull();
  });

  it("round-trips text containing special URL characters (spaces, &, #, unicode)", () => {
    const state = makeState({ text: "café & croissant\n#1 #2", name: "Special / chars?" });
    const url = buildShareUrl("https://example.com/", state);
    const hash = url.split("#").slice(1).join("#"); // text/name may itself contain '#'

    expect(readStateFromHash(hash)).toEqual(state);
  });

  it("full round trip via the default state", () => {
    const state = defaultState();
    const url = buildShareUrl("https://example.com/", state);
    const hash = url.slice(url.indexOf("#") + 1);
    expect(readStateFromHash(hash)).toEqual(state);
  });
});
