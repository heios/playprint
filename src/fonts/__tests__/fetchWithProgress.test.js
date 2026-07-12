import { describe, expect, it, vi } from "vitest";
import { fetchArrayBufferWithProgress } from "../fetchWithProgress.js";

/**
 * Integration-style tests against a hand-built fake `fetch`/`Response` that
 * mimics a real streaming download (SPEC.md: "fetched on selection with a
 * DETERMINATE progress bar (stream vs Content-Length)"). No real network -
 * these assert the adapter's contract, not the pure engine, per SPEC.md
 * Testing Decisions ("Font resolution... covered by a small number of
 * integration checks").
 */
function fakeStreamingFetch(chunks, { contentLength } = {}) {
  let i = 0;
  const reader = {
    read: vi.fn(async () => {
      if (i >= chunks.length) return { done: true, value: undefined };
      const value = chunks[i++];
      return { done: false, value };
    }),
  };
  const headers = { get: (name) => (name === "Content-Length" ? (contentLength ?? null) : null) };
  const response = {
    ok: true,
    status: 200,
    headers,
    body: { getReader: () => reader },
    arrayBuffer: async () => {
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      return merged.buffer;
    },
  };
  return vi.fn(async () => response);
}

describe("fetchArrayBufferWithProgress", () => {
  it("reports determinate, monotonically increasing progress against Content-Length", async () => {
    const chunks = [new Uint8Array(30), new Uint8Array(30), new Uint8Array(40)];
    const fetchImpl = fakeStreamingFetch(chunks, { contentLength: "100" });
    const events = [];

    const buffer = await fetchArrayBufferWithProgress("https://example.com/font.ttf", (p) => events.push(p), {
      fetch: fetchImpl,
    });

    expect(buffer.byteLength).toBe(100);
    expect(events).toEqual([
      { loadedBytes: 30, totalBytes: 100 },
      { loadedBytes: 60, totalBytes: 100 },
      { loadedBytes: 100, totalBytes: 100 },
    ]);
    // Determinate: every event has a known total, so a UI can render a real percentage.
    for (const e of events) expect(e.totalBytes).not.toBeNull();
  });

  it("falls back to indeterminate progress (totalBytes: null) when Content-Length is missing", async () => {
    const chunks = [new Uint8Array(10)];
    const fetchImpl = fakeStreamingFetch(chunks, { contentLength: null });
    const events = [];

    await fetchArrayBufferWithProgress("https://example.com/font.ttf", (p) => events.push(p), { fetch: fetchImpl });

    expect(events).toEqual([{ loadedBytes: 10, totalBytes: null }]);
  });

  it("throws a descriptive error on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(
      fetchArrayBufferWithProgress("https://example.com/missing.ttf", undefined, { fetch: fetchImpl }),
    ).rejects.toThrow(/404/);
  });

  it("throws when no fetch implementation is available anywhere (no injected impl, no global fetch)", async () => {
    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line no-undefined -- simulate an environment with no global fetch at all.
    globalThis.fetch = undefined;
    try {
      await expect(fetchArrayBufferWithProgress("https://example.com/font.ttf")).rejects.toThrow(
        /no fetch implementation/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to the global fetch when no fetch is injected", async () => {
    const originalFetch = globalThis.fetch;
    const chunks = [new Uint8Array(5)];
    globalThis.fetch = fakeStreamingFetch(chunks, { contentLength: "5" });
    try {
      const buffer = await fetchArrayBufferWithProgress("https://example.com/font.ttf");
      expect(buffer.byteLength).toBe(5);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
