/**
 * Subsequence fuzzy matching with a score and the matched offsets.
 *
 * Deliberately small: no index, no n-grams, no library. The candidate sets here
 * are a page of API results plus ~40 navigation entries, so the cost of a
 * cleverer algorithm would exceed what it saves. It handles the two things
 * operators actually do — type a prefix, and type the initials of a multi-word
 * name — and it is bilingual, because it never assumes a script.
 */

/** Arabic presentation forms and diacritics folded to a comparable base. */
const ARABIC_DIACRITICS = /[ً-ٰٟـ]/g;

/**
 * Folds a string to its comparison form: lowercase, no diacritics, alef and
 * ya/ta-marbuta variants unified. Arabic names are spelled inconsistently and
 * an operator should not have to guess which alef was typed at the counter.
 */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[̀-ͯ]/g, "");
}

export type FuzzyMatch = {
  score: number;
  /** Offsets into the *original* text, safe to slice for highlighting. */
  matches: number[];
};

const SCORE = {
  /** The whole query appears verbatim. */
  exact: 1000,
  /** …at the very start. */
  prefix: 400,
  /** …at the start of any word. */
  wordStart: 200,
  /** Each character matched in sequence. */
  character: 10,
  /** Bonus for a character that continued the previous match. */
  consecutive: 15,
  /** Penalty per character skipped, so tight matches outrank scattered ones. */
  gap: -1,
};

/**
 * Scores `query` against `text`. Returns `null` when the query is not a
 * subsequence of the text, which is the common case and the cheap exit.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  if (!query) return { score: 0, matches: [] };

  const foldedQuery = fold(query);
  const foldedText = fold(text);
  // Folding is character-preserving for the scripts in use here, so offsets in
  // the folded string address the same characters in the original.
  if (foldedQuery.length > foldedText.length) return null;

  const direct = foldedText.indexOf(foldedQuery);
  if (direct !== -1) {
    const matches = Array.from(
      { length: foldedQuery.length },
      (_, offset) => direct + offset,
    );
    const isWordStart = direct === 0 || /[\s\-_/]/.test(foldedText[direct - 1]);
    const bonus =
      direct === 0 ? SCORE.prefix : isWordStart ? SCORE.wordStart : 0;
    return { score: SCORE.exact + bonus - direct, matches };
  }

  const matches: number[] = [];
  let score = 0;
  let cursor = 0;
  let previous = -1;

  for (const char of foldedQuery) {
    const found = foldedText.indexOf(char, cursor);
    if (found === -1) return null;

    score += SCORE.character;
    if (found === previous + 1) score += SCORE.consecutive;
    if (found === 0 || /[\s\-_/]/.test(foldedText[found - 1])) {
      score += SCORE.wordStart;
    }
    score += (found - cursor) * SCORE.gap;

    matches.push(found);
    previous = found;
    cursor = found + 1;
  }

  return { score, matches };
}

/**
 * Best match across several fields. Only offsets from `fields[0]` are returned,
 * because that is the field the palette renders as the title — a highlight
 * pointing into a subtitle would land on the wrong characters.
 */
export function matchFields(
  query: string,
  fields: (string | null | undefined)[],
): FuzzyMatch | null {
  let best: FuzzyMatch | null = null;

  fields.forEach((field, index) => {
    if (!field) return;
    const match = fuzzyMatch(query, field);
    if (!match) return;
    // A hit outside the title still ranks the row, but scores lower and carries
    // no offsets.
    const candidate =
      index === 0 ? match : { score: match.score * 0.6, matches: [] };
    if (!best || candidate.score > best.score) best = candidate;
  });

  return best;
}

export type HighlightSegment = { text: string; match: boolean };

/** Splits `text` into alternating plain and matched runs, ready to render. */
export function highlight(
  text: string,
  matches: number[],
): HighlightSegment[] {
  if (matches.length === 0) return [{ text, match: false }];

  const flags = new Set(matches);
  const segments: HighlightSegment[] = [];
  let start = 0;
  let current = flags.has(0);

  for (let index = 1; index <= text.length; index += 1) {
    const isMatch = flags.has(index);
    if (index === text.length || isMatch !== current) {
      segments.push({ text: text.slice(start, index), match: current });
      start = index;
      current = isMatch;
    }
  }

  return segments;
}
