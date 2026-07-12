/**
 * Thin I/O helper: fetches a URL and reports DETERMINATE download progress
 * (SPEC.md Fonts: "the TTF is fetched on selection with a determinate
 * progress bar (stream vs `Content-Length`)"). Reads the response body via
 * its `ReadableStream` and reports bytes-read against the `Content-Length`
 * header; falls back to indeterminate (`total: null`) progress if the header
 * is missing or the stream reader isn't available (older browsers, or a
 * test double), never throwing on that account.
 *
 * Pure I/O, no font-format knowledge — `loadFont.js` composes this with
 * `decodeWoff2ToTtf.js` to build the full pipeline.
 *
 * @param {string} url
 * @param {(progress: { loadedBytes: number, totalBytes: number|null }) => void} [onProgress]
 * @param {{ fetch?: typeof fetch }} [deps] - injectable for tests
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchArrayBufferWithProgress(url, onProgress = () => {}, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchArrayBufferWithProgress: no fetch implementation available");
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`fetchArrayBufferWithProgress: ${url} responded ${response.status}`);
  }

  const totalHeader = response.headers?.get?.("Content-Length");
  const totalBytes = totalHeader ? Number(totalHeader) : null;

  const reader = response.body?.getReader?.();
  if (!reader) {
    // No streaming support (or a test stub `Response`): fall back to a single
    // await, reporting one final progress event so callers always see 100%.
    const buffer = await response.arrayBuffer();
    onProgress({ loadedBytes: buffer.byteLength, totalBytes: totalBytes ?? buffer.byteLength });
    return buffer;
  }

  const chunks = [];
  let loadedBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.byteLength;
    onProgress({ loadedBytes, totalBytes });
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}
