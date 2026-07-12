// @ts-check
// JSDoc @typedef module for the seam contracts (SPEC.md "Implementation
// Decisions"). NO runtime exports — purely for type definitions referenced via
// `import('./types.js').Foo` or `@import` in the engine and control registry.
//
// The value is pinning the load-bearing engine boundary (state in → passes →
// LayoutResult out) so drift is caught as a type error the moment a pass or
// renderer stops honouring the contract (issue #14).

/**
 * @typedef {object} ProjectState
 * @property {number} schemaVersion
 * @property {string} name
 * @property {string} text
 * @property {number} seed
 * @property {PageSettings} page
 * @property {LayoutSettings} layout
 * @property {CardStyle} card
 * @property {LetterStyle} letters
 * @property {VisibilitySettings} visibility
 */

/**
 * @typedef {object} PageSettings
 * @property {string} size - Paper size code (e.g., "A4")
 * @property {"portrait" | "landscape"} orientation
 * @property {number} marginMm
 */

/**
 * @typedef {object} LayoutSettings
 * @property {string} mode - "grid" | "flexible" | "random"
 * @property {string} cardSizing - "uniform" | "fit"
 * @property {number} gapMm
 * @property {"left" | "center" | "right"} rowAlign
 * @property {object} grid
 * @property {number | "auto"} grid.columns
 * @property {object} [random]
 * @property {number} [random.rotationDeg]
 * @property {number} [random.shiftMm]
 */

/**
 * @typedef {object} CardStyle
 * @property {FontSpec} font
 * @property {string} textColor
 * @property {number} paddingMm
 * @property {number} [offsetMm]
 * @property {number} [rotationDeg]
 * @property {BorderStyle} inner
 * @property {OuterBorderStyle} [outer]
 */

/**
 * @typedef {object} FontSpec
 * @property {string} family
 * @property {string} source - "builtin" | "curated" | "custom"
 * @property {number} sizePt
 * @property {number} letterSpacingMm
 */

/**
 * @typedef {object} BorderStyle
 * @property {string} color
 * @property {number} strokeMm
 * @property {number} radiusMm
 * @property {boolean} [visible]
 */

/**
 * @typedef {object} OuterBorderStyle
 * @property {boolean} enabled
 * @property {string} color
 * @property {number} strokeMm
 * @property {number} radiusMm
 * @property {number} matPercent
 * @property {number} minClearanceMm
 * @property {number} balanceRatio
 */

/**
 * @typedef {object} LetterStyle
 * @property {string} style - "random" | "wave" | "alternating" | "smile"
 * @property {number} rotationDeg
 * @property {number} verticalMm
 * @property {number} [horizontalJitterMm]
 * @property {number} [waveFrequency]
 */

/**
 * @typedef {object} VisibilitySettings
 * @property {boolean} outer
 * @property {boolean} inner
 * @property {boolean} text
 */

/**
 * @typedef {object} Env
 * @property {function(string, object?): {widthMm: number, heightMm: number, ascentMm: number}} measureText
 */

/**
 * @typedef {object} PassContext
 * @property {ProjectState} state
 * @property {Env} env
 * @property {Doc} [doc]
 */

/**
 * @typedef {object} Pass
 * @property {function(PassContext): PassContext | LayoutResult} call
 */

/**
 * @typedef {object} Doc
 *
 * Kept loose to support additive pass fields without type friction. Each pass
 * extends it by adding more properties; the type checker doesn't enforce a
 * rigid schema here, only the PUBLIC boundary (state in, LayoutResult out,
 * ctx signature, env). The per-pass `doc` is an intermediate working object.
 * @property {string[][] | undefined} [rows]
 * @property {Array<any> | undefined} [cards]
 * @property {object | undefined} [page]
 */

/**
 * @typedef {object} LayoutResult
 * @property {Page[]} pages
 */

/**
 * @typedef {object} Page
 * @property {number} widthMm
 * @property {number} heightMm
 * @property {number} [marginMm]
 * @property {Card[]} cards
 */

/**
 * @typedef {object} Card
 * @property {Rect} innerRect
 * @property {Glyph[]} glyphs
 * @property {BorderStyle} [inner]
 * @property {BorderStyle} [outer]
 * @property {boolean} [textVisible]
 * @property {number} [tiltDeg]
 * @property {object} [tiltOriginMm]
 * @property {number} [tiltOriginMm.x]
 * @property {number} [tiltOriginMm.y]
 * @property {Rect} [outerRect]
 */

/**
 * @typedef {object} Rect
 * @property {number} xMm
 * @property {number} yMm
 * @property {number} widthMm
 * @property {number} heightMm
 */

/**
 * @typedef {object} Glyph
 * @property {string} char
 * @property {number} x
 * @property {number} y
 * @property {number} [rotationDeg]
 */

export {};
