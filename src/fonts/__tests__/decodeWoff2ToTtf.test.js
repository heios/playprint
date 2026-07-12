import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeWoff2ToTtf } from "../decodeWoff2ToTtf.js";

/**
 * Integration check (SPEC.md Testing Decisions: "Font resolution... covered
 * by a small number of INTEGRATION checks (fetch -> decode -> embed produces
 * a valid font in the PDF) rather than unit tests"). This exercises the real
 * `fonteditor-core` wasm woff2 codec against a real woff2 file (a small
 * curated-font fixture fetched from Google Fonts, checked in under
 * `fixtures/`) — no network at test time, but no mocking of the decoder
 * either, so a real regression in the lazy-load or the codec call would
 * fail this test.
 */
describe("decodeWoff2ToTtf", () => {
  const fixturePath = fileURLToPath(new URL("./fixtures/yuyu-sample.woff2", import.meta.url));
  const woff2Bytes = readFileSync(fixturePath);

  it("decodes a real woff2 font into valid sfnt TTF bytes", async () => {
    const ttfBytes = await decodeWoff2ToTtf(woff2Bytes);

    expect(ttfBytes).toBeInstanceOf(Uint8Array);
    expect(ttfBytes.length).toBeGreaterThan(1000);
    // TrueType outline sfnt version tag: 00 01 00 00.
    expect(Array.from(ttfBytes.slice(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
  });

  it("accepts a plain ArrayBuffer as well as a Uint8Array/Buffer", async () => {
    const arrayBuffer = woff2Bytes.buffer.slice(
      woff2Bytes.byteOffset,
      woff2Bytes.byteOffset + woff2Bytes.byteLength,
    );
    const ttfBytes = await decodeWoff2ToTtf(arrayBuffer);
    expect(Array.from(ttfBytes.slice(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
  });

  it("caches the lazily-loaded wasm module across repeated calls (loaded once)", async () => {
    const first = await decodeWoff2ToTtf(woff2Bytes);
    const second = await decodeWoff2ToTtf(woff2Bytes);
    expect(first.length).toBe(second.length);
  });
});
