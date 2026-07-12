# playprint

A single static HTML page (publishable to GitHub Pages) that generates playful children's
cut-out card templates — month names, digits, or any text — and exports a multi-page PDF.

The full product spec is in **[SPEC.md](SPEC.md)** — the single source of truth. Read it before
implementing; do not re-derive it.

## Git conventions

- **Author identity** for all commits: `heios <40836953+heios@users.noreply.github.com>`
  (configured as the repo-local `user.name` / `user.email`).
- Every commit produced while working a ticket **must** append a `Generated-by` trailer naming the
  Anthropic model(s) that did the work:

  ```
  Generated-by: anthropic/<model-id>
  ```

  Valid model ids: `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`,
  `claude-haiku-4-5-20251001`. If more than one model researched, wrote tools, or wrote code for
  the ticket, add **one `Generated-by:` line per model** that contributed.

## Reference material

`.references/` holds the source craft that grounds the spec (the "Fun project: A calendar" workbook
scans, photos of the matted cards, and `output/page.svg` — the SVG-in-mm → PDF convention). It is
**gitignored**: kept locally for reference, never committed.
