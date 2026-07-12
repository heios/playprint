// @ts-check
/** @import { ProjectState } from '../engine/types.js' */

/**
 * Control-panel registration API.
 *
 * This is the extension seam for the control panel: a later slice adds a
 * self-contained control group by creating ONE new file under
 * `./groups/*.js` that calls `registerControlGroup(...)` — no shared list of
 * groups to edit, so parallel worktrees never collide here.
 *
 * A "control group" is a declarative description of a related cluster of
 * inputs (e.g. "Paper size & orientation", "Outer mat"), not the rendered
 * DOM. `render.js` (a thin renderer) walks the registry and builds inputs
 * from it; groups never touch the DOM or each other directly.
 */

const groups = [];

/**
 * @typedef {Object} ControlDef
 * @property {string} id - unique within the group
 * @property {string} label
 * @property {"slider"|"toggle"|"select"|"text"|"color"} type
 * @property {(state: object) => unknown} getValue - reads this control's
 *   current value out of the shared ProjectState (SPEC.md "State object").
 * @property {(state: object, value: unknown) => object} setValue - returns a
 *   *new* state with this control's value applied (pure, no mutation).
 * @property {(state: object) => boolean} [isVisible] - progressive
 *   disclosure hook (SPEC.md: "the control panel shows only the parameters
 *   relevant to the current mode/selection"). Defaults to always-visible.
 */

/**
 * @typedef {Object} ControlGroupDef
 * @property {string} id - unique across the whole panel
 * @property {string} label
 * @property {ControlDef[]} controls
 * @property {(state: object) => boolean} [isVisible] - e.g. the outer-mat
 *   group only shows once `card.outer.enabled` is true (SPEC.md story 21).
 */

/**
 * Register a control group. Call this once, at module load, from a
 * self-contained file under `./groups/`. Order of registration is the
 * display order in the panel.
 *
 * @param {ControlGroupDef} group
 */
export function registerControlGroup(group) {
  if (!group || typeof group.id !== "string" || group.id.length === 0) {
    throw new Error("registerControlGroup: group.id is required");
  }
  if (groups.some((existing) => existing.id === group.id)) {
    throw new Error(`registerControlGroup: duplicate group id "${group.id}"`);
  }

  groups.push(group);
}

/**
 * @returns {ControlGroupDef[]} all registered groups, in registration order.
 */
export function getRegisteredControlGroups() {
  return [...groups];
}

/** Test-only: reset the registry between test files/cases. */
export function _resetRegistryForTests() {
  groups.length = 0;
}
