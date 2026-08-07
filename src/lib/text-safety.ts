/**
 * Directional formatting characters, and why this file exists.
 *
 * Every screen in this application is bidirectional by design: an Arabic
 * register routinely holds Latin names, Latin registers hold Arabic ones, and
 * `unicode-bidi: isolate` in `globals.css` plus `<bdi>` in the cell components
 * make each value reorder only itself.
 *
 * That handles *implicit* direction — the algorithm's own reading of a string.
 * It does not handle the eight characters below, which are explicit
 * instructions the renderer obeys no matter what the surrounding markup says:
 *
 *   U+202A LRE  U+202B RLE  U+202C PDF  U+202D LRO  U+202E RLO
 *   U+2066 LRI  U+2067 RLI  U+2068 FSI  U+2069 PDI
 *
 * A beneficiary name stored as `"\u202E" + "LYD 5.000 to"` renders as
 * something else entirely, and the screen where that matters is the approval
 * queue — an operator releasing funds reads a string that is not the string
 * the backend holds, and the audit record afterwards is the real one. This is
 * the display half of the "Trojan Source" class; the source-code half does not
 * apply here, the rendered-record half very much does.
 *
 * The isolate initiators (U+2066–U+2068) and PDI are stripped as well, even
 * though they nest safely on their own: `isolate()` wraps display values in
 * FSI…PDI, and an unmatched PDI inside a value closes that wrapper early,
 * which puts the rest of the value back into the surrounding context. A
 * defence that a value can end from the inside is not a defence.
 *
 * LRM (U+200E) and RLM (U+200F) are deliberately kept. They are marks, not
 * overrides: they set the direction of neighbouring *neutral* characters and
 * cannot reorder runs. They also appear in ordinary Arabic text that people
 * paste from real documents, and inside an isolate their effect cannot leave
 * the value. Stripping them would corrupt legitimate names to prevent nothing.
 */

/**
 * Explicit embeddings, overrides and isolates. Deliberately not a character
 * class of "everything invisible" — see the note on LRM/RLM above.
 */
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Removes directional overrides from a value about to be displayed or
 * exported. Applied at the render boundary rather than on ingest, because the
 * backend is the system of record and this application does not get to decide
 * what it stores — only what it is willing to show as if it were the truth.
 */
export function neutralizeBidi(value: string): string {
  return value.replace(BIDI_CONTROLS, "");
}

/**
 * The input half. `neutralizeBidi` keeps existing records readable; this keeps
 * this application from being the thing that put an override into one.
 * Rejecting rather than silently stripping is the right call on a form: a name
 * the operator typed and a name the system saved must be the same string, and
 * a quiet edit to a beneficiary name is its own kind of surprise.
 */
export function hasBidiControls(value: string): boolean {
  // `test` on a `/g` regex is stateful; a fresh check every call.
  return /[\u202A-\u202E\u2066-\u2069]/.test(value);
}

/**
 * Zod-shaped predicate for the fields an operator types by hand: names,
 * addresses, bank names — the free text that ends up on a transfer record and
 * is then read back by whoever approves it.
 *
 * Optional fields pass when absent, so the same refinement can sit on a
 * required and an optional string without a wrapper at each call site.
 */
export function directionSafe(value: string | undefined | null): boolean {
  return value === undefined || value === null || !hasBidiControls(value);
}
