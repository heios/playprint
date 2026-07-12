import { tokenize } from "./passes/tokenize.js";
import { size } from "./passes/size.js";
import { place } from "./passes/place.js";
import { letterTransforms } from "./passes/letterTransforms.js";
import { mat } from "./passes/mat.js";
import { paginate } from "./passes/paginate.js";

/**
 * The single source-of-truth entrypoint: `computeLayout(state, env) → LayoutResult`.
 *
 * Pure and dependency-free (SPEC.md "Implementation Decisions"). It threads
 * an intermediate `{ state, env, doc }` value through a fixed pipeline of
 * discrete, pure passes, each living in its own module under `./passes/`:
 *
 *   tokenize → size → place → letterTransforms → mat → paginate
 *
 * Every pass is a plain function `({ state, env, doc }) → { state, env, doc }`
 * (the final pass, `paginate`, instead returns the `LayoutResult` itself:
 * `{ pages: [{ cards: [{ outerRect, innerRect, glyphs }] }] }`, all in mm).
 *
 * Adding a pass (e.g. splitting `mat` into `padding` + `matClamp`) means:
 *   1. add a new file under `./passes/`, following the same
 *      `({ state, env, doc }) → { state, env, doc }` shape,
 *   2. insert it into the `passes` array below in the right position.
 * No other pass needs to change — each only reads the `doc` shape the
 * previous pass produced and adds/refines fields on it.
 *
 * `env` supplies I/O the pure engine cannot do itself — currently just
 * `measureText(text, opts) → { widthMm, heightMm }`, backed by a page-side
 * canvas in the real app and a stub in tests (see
 * `./__tests__/stubEnv.js`), so preview and PDF measure text identically.
 */
const passes = [tokenize, size, place, letterTransforms, mat, paginate];

export function computeLayout(state, env) {
  let ctx = { state, env, doc: undefined };

  for (const pass of passes) {
    ctx = pass(ctx);
  }

  // The last pass (paginate) returns the LayoutResult directly rather than
  // another { state, env, doc } context.
  return ctx;
}
