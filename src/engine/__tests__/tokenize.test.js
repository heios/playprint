import { describe, expect, it } from "vitest";
import { tokenize } from "../passes/tokenize.js";
import { createStubEnv } from "./stubEnv.js";

/**
 * Each pipeline pass is independently testable in isolation — proving the
 * module boundaries in the tokenize → size → place → letterTransforms →
 * mat → paginate pipeline are real, not just an internal detail of
 * computeLayout.
 */
describe("tokenize pass", () => {
  it("splits whitespace-separated text into rows of tokens", () => {
    const env = createStubEnv();
    const { doc } = tokenize({ state: { text: "January February" }, env });

    expect(doc.rows).toEqual([["January", "February"]]);
  });

  it("treats newlines as hard row breaks", () => {
    const env = createStubEnv();
    const { doc } = tokenize({ state: { text: "one two\nthree" }, env });

    expect(doc.rows).toEqual([["one", "two"], ["three"]]);
  });
});
