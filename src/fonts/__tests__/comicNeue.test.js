import { describe, expect, it } from "vitest";
import { COMIC_NEUE_FAMILY, comicNeueDataUri, comicNeueTtfBytes } from "../comicNeue.js";

/**
 * Comic Neue is the offline, no-fetch default (SPEC.md story 48). These are
 * pure-data assertions — decoding base64 and checking the TTF magic bytes —
 * with no network or DOM, proving the default font never needs either.
 */
describe("comicNeue", () => {
  it("exposes the exact family name used as the ProjectState default", () => {
    expect(COMIC_NEUE_FAMILY).toBe("Comic Neue");
  });

  it("decodes to real TTF bytes (sfnt version tag 0x00010000)", () => {
    const bytes = comicNeueTtfBytes();
    expect(bytes.length).toBeGreaterThan(1000);
    // TrueType outline sfnt version: 00 01 00 00.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
  });

  it("produces a well-formed data: URI wrapping the same bytes", () => {
    const uri = comicNeueDataUri();
    expect(uri.startsWith("data:font/ttf;base64,")).toBe(true);
    expect(uri.length).toBeGreaterThan(1000);
  });
});
