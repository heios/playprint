/**
 * Side-effect-only barrel: importing this module registers every control
 * group. Each import below runs a file that calls `registerControlGroup`
 * once at module load (see `../registry.js`).
 *
 * Adding a new group is a ONE-LINE addition here (an import, not an edit to
 * any group definition/list) — the group's id, label, controls, and
 * visibility rule live entirely in its own file. This file only needs to
 * exist because ES modules require *something* to import a module before
 * its top-level side effects run; it never describes what a group contains.
 */
import "./text.group.js";
import "./presets.group.js";
import "./border.group.js";
import "./layout.group.js";
