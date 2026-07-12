import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";

/**
 * Issue #1 scope: the pipeline seam itself, not product behaviour.
 * SPEC.md "Testing Decisions" calls out determinism as the baseline contract
 * for the pure engine: same state + same env → identical LayoutResult.
 */
describe("computeLayout (scaffold seam)", () => {
  it("is deterministic: the same state and env produce an identical LayoutResult", () => {
    const state = { schemaVersion: 1, text: "", seed: 1 };
    const env = createStubEnv();

    const first = computeLayout(state, env);
    const second = computeLayout(state, env);

    expect(second).toEqual(first);
  });

  it("returns the LayoutResult tree shape described in SPEC.md: { pages: [] }", () => {
    const state = { schemaVersion: 1, text: "", seed: 1 };
    const env = createStubEnv();

    const result = computeLayout(state, env);

    expect(result).toHaveProperty("pages");
    expect(Array.isArray(result.pages)).toBe(true);
  });
});
