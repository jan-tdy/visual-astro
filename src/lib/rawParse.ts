/**
 * RAW mode parsing: turn one compact hand-typed line into an observation.
 *
 * Format: <starLetters><A><pasoA>v<pasoB><B><UT>
 * - star: leading letters (matched against catalog names / VSNET / AAVSO codes)
 * - 'v' (upper/lower) separates left (A + pasoA) and right (pasoB + B + UT)
 * - pasoA = last single digit of left; A = everything before
 * - pasoB = first single digit of right; then B; UT = trailing 3-4 digits
 * - dashes '-' inside A/B are converted to '.' (so "12-5" -> "12.5")
 *
 * Examples:
 *   "agdraf3v1g2108"       -> AG Dra   A=f    pA=3 pB=1 B=g    UT=21:08
 *   "mvlyr12-51v312-92110" -> MV Lyr   A=12.5 pA=1 pB=3 B=12.9 UT=21:10
 *
 * The star token is resolved by {@link matchStarToken}, which also autocorrects
 * common miswrites (truncated names, wrong constellation, typos). Every
 * non-exact match is reported back as a {@link RawCorrection} so the UI can warn
 * about it — an autocorrect the observer never sees is worse than no autocorrect.
 */

/** The 88 IAU three-letter constellation abbreviations (lowercase). */
export const IAU_ABBREVS = new Set([
  "and", "ant", "aps", "aqr", "aql", "ara", "ari", "aur", "boo", "cae",
  "cam", "cnc", "cvn", "cma", "cmi", "cap", "car", "cas", "cen", "cep",
  "cet", "cha", "cir", "col", "com", "cra", "crb", "crv", "crt", "cru",
  "cyg", "del", "dor", "dra", "equ", "eri", "for", "gem", "gru", "her",
  "hor", "hya", "hyi", "ind", "lac", "leo", "lmi", "lep", "lib", "lup",
  "lyn", "lyr", "men", "mic", "mon", "mus", "nor", "oct", "oph", "ori",
  "pav", "peg", "per", "phe", "pic", "psc", "psa", "pup", "pyx", "ret",
  "sge", "sgr", "sco", "scl", "sct", "ser", "sex", "tau", "tel", "tri",
  "tra", "tuc", "uma", "umi", "vel", "vir", "vol", "vul",
]);

export type CorrectionKind =
  /** typed name was a truncation of exactly one catalog name ("sdss1730" -> "sdss173062dra") */
  | "prefix"
  /** designation matched but the constellation did not ("v404her" -> "v404cyg") */
  | "constellation"
  /** designation matched after normalising ("404cyg" -> "v404cyg") */
  | "designation"
  /** close enough by edit distance to exactly one catalog name ("agdar" -> "agdra") */
  | "typo";

export type RawCorrection = {
  /** the exact characters consumed from the typed line */
  from: string;
  /** the catalog token that was used instead */
  to: string;
  kind: CorrectionKind;
};

export type StarMatchIndex = {
  /** catalog tokens, longest first */
  tokens: string[];
  /** loose designation (see {@link looseDesig}) -> catalog tokens carrying it */
  byDesig: Map<string, string[]>;
};

/**
 * Strip the leading "v" of a variable-star designation ("v404" -> "404") so a
 * line that omits it still resolves, and drop anything but letters and digits.
 */
export function looseDesig(desig: string): string {
  const d = desig.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^v\d/.test(d) ? d.slice(1) : d;
}

/**
 * Split a normalised catalog token into designation + IAU constellation, or
 * null when it does not end in a known abbreviation ("v404cyg" -> v404 / cyg).
 */
export function splitConstellation(token: string): { desig: string; con: string } | null {
  if (token.length < 4) return null;
  const con = token.slice(-3);
  if (!IAU_ABBREVS.has(con)) return null;
  return { desig: token.slice(0, -3), con };
}

/** Precompute the lookup structures used by {@link matchStarToken}. */
export function buildStarMatchIndex(tokens: string[]): StarMatchIndex {
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const byDesig = new Map<string, string[]>();
  for (const tk of sorted) {
    const split = splitConstellation(tk);
    if (!split || !split.desig) continue;
    const key = looseDesig(split.desig);
    if (!key) continue;
    const arr = byDesig.get(key);
    if (arr) arr.push(tk);
    else byDesig.set(key, [tk]);
  }
  return { tokens: sorted, byDesig };
}

/**
 * Levenshtein distance between `tk` and the *best prefix* of `s`, capped at
 * `maxDist`. Returns how many characters of `s` that best prefix consumed.
 */
export function prefixDistance(
  tk: string,
  s: string,
  maxDist: number,
): { dist: number; consumed: number } {
  const sub = s.slice(0, Math.min(s.length, tk.length + maxDist));
  let prev = new Array<number>(sub.length + 1);
  let cur = new Array<number>(sub.length + 1);
  for (let j = 0; j <= sub.length; j++) prev[j] = j;
  for (let i = 1; i <= tk.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= sub.length; j++) {
      const cost = tk[i - 1] === sub[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  let dist = Infinity;
  let consumed = 0;
  const lo = Math.max(0, tk.length - maxDist);
  for (let j = lo; j <= sub.length; j++) {
    if (prev[j] < dist) {
      dist = prev[j];
      consumed = j;
    }
  }
  return { dist, consumed };
}

export type StarMatch = {
  token: string;
  consumed: number;
  correction?: RawCorrection;
};

/**
 * Resolve the star at the start of a normalised raw line.
 *
 * Tiers, most trustworthy first — the first one that resolves *uniquely* wins:
 *  1. exact prefix (no warning),
 *  2. designation + constellation ("v404her" / "404cyg" -> "v404cyg"),
 *  3. unique truncation ("sdss1730" -> "sdss173062dra"),
 *  4. unique near-miss by edit distance ("agdar" -> "agdra").
 *
 * The constellation tier deliberately runs before the truncation tier: for
 * "v404herf3v1g2108" a plain prefix scan would happily stop after "v404" and
 * then parse "herf" as the A comparator, which silently corrupts the row.
 */
export function matchStarToken(
  s: string,
  index: StarMatchIndex,
  opts: { fuzzy?: boolean } = {},
): StarMatch | null {
  if (!s) return null;
  // On a "+" continuation line the name is usually omitted entirely, so the
  // line starts with comparator data. The loose tiers must stay off there:
  // guessing a star out of "f3v1g2130" would silently file the observation
  // under the wrong object. An explicit constellation is specific enough to
  // still be trusted, which is why tier 2 stays on.
  const fuzzy = opts.fuzzy ?? true;

  // 1) Exact: longest known token that the line starts with.
  let exact = "";
  for (const tk of index.tokens) {
    if (tk && s.startsWith(tk)) { exact = tk; break; } // tokens are longest-first
  }
  if (exact) return { token: exact, consumed: exact.length };

  // 2) <designation><constellation>: accept a wrong constellation or a missing
  //    leading "v" as long as the designation points at exactly one star.
  const maxScan = Math.min(s.length, 16);
  for (let i = 4; i <= maxScan; i++) {
    const con = s.slice(i - 3, i);
    if (!IAU_ABBREVS.has(con)) continue;
    const desig = s.slice(0, i - 3);
    const key = looseDesig(desig);
    if (key.length < 2) continue;
    let candidates = index.byDesig.get(key);
    if (!candidates) {
      // designation itself truncated ("sdss1730dra" -> "sdss173062dra")
      const hits: string[] = [];
      for (const [k, arr] of index.byDesig) {
        if (k.startsWith(key)) hits.push(...arr);
      }
      candidates = hits;
    }
    if (candidates.length !== 1) continue;
    const token = candidates[0];
    const split = splitConstellation(token);
    const kind: CorrectionKind = split && split.con !== con ? "constellation" : "designation";
    return {
      token,
      consumed: i,
      correction: { from: s.slice(0, i), to: token, kind },
    };
  }

  if (!fuzzy) return null;

  // 3) Truncation: longest common prefix of at least 3 chars, unique.
  const MIN_PREFIX = 3;
  let bestLen = 0;
  let bestTk = "";
  let tie = false;
  for (const tk of index.tokens) {
    const max = Math.min(tk.length, s.length);
    let k = 0;
    while (k < max && tk[k] === s[k]) k++;
    if (k >= MIN_PREFIX) {
      if (k > bestLen) { bestLen = k; bestTk = tk; tie = false; }
      else if (k === bestLen && tk !== bestTk) tie = true;
    }
  }
  if (bestTk && !tie) {
    // A common prefix alone says nothing about where the *name* ends: for a
    // misspelling like "agdar…" it stops after "agd" and the leftover "ar"
    // would be parsed as comparator data. If the whole typed name is a close
    // near-miss of this star, trust that length instead.
    const near = prefixDistance(bestTk, s, 2);
    if (near.dist <= 2 && near.consumed > bestLen) {
      return {
        token: bestTk,
        consumed: near.consumed,
        correction: { from: s.slice(0, near.consumed), to: bestTk, kind: "typo" },
      };
    }
    return {
      token: bestTk,
      consumed: bestLen,
      correction: { from: s.slice(0, bestLen), to: bestTk, kind: "prefix" },
    };
  }

  // 4) Typo: unique near-miss by edit distance. Kept last and deliberately
  //    strict (same first letter, no ties) — a wrong star is worse than none.
  let fuzzyDist = Infinity;
  let fuzzyTk = "";
  let fuzzyConsumed = 0;
  let fuzzyTie = false;
  for (const tk of index.tokens) {
    if (tk.length < 4 || tk[0] !== s[0]) continue;
    const maxDist = tk.length <= 5 ? 1 : 2;
    const { dist, consumed } = prefixDistance(tk, s, maxDist);
    if (dist > maxDist) continue;
    // Never let edit distance rewrite a constellation: "v404her" is two edits
    // from "v404lyr" and three from "v404cyg", so a blind fuzzy match would
    // confidently pick the wrong star. Constellations are the job of tier 2,
    // which only fires when the designation itself is unambiguous.
    const typedCon = consumed >= 3 ? s.slice(consumed - 3, consumed) : "";
    const tokenCon = splitConstellation(tk)?.con;
    if (typedCon && tokenCon && IAU_ABBREVS.has(typedCon) && typedCon !== tokenCon) continue;
    if (dist < fuzzyDist) { fuzzyDist = dist; fuzzyTk = tk; fuzzyConsumed = consumed; fuzzyTie = false; }
    else if (dist === fuzzyDist && tk !== fuzzyTk) fuzzyTie = true;
  }
  if (fuzzyTk && !fuzzyTie && fuzzyConsumed > 0) {
    return {
      token: fuzzyTk,
      consumed: fuzzyConsumed,
      correction: { from: s.slice(0, fuzzyConsumed), to: fuzzyTk, kind: "typo" },
    };
  }

  return null;
}

export type ParsedRaw = {
  starToken: string;
  a: string | null; pasos_a: number | null;
  pasos_b: number | null; b: string | null;
  ut_time: string | null;
  limit_value?: string | null;
  note?: string | null;
  /** 0 = new star, 1 = "+" (2nd obs of previous star), 2 = "++" ... */
  plusLevel?: number;
  /** set when the star name was autocorrected — surfaced to the observer */
  correction?: RawCorrection;
  /**
   * Characters of the normalised, "+"-stripped line consumed by the star
   * match (0 when nothing matched). Lets a caller rebuild the line after
   * swapping in a different star token: `newToken + s.slice(matchLen)`.
   */
  matchLen: number;
};

/**
 * Rewrite the star name on one raw-text line, leaving the paso/UT/note data
 * untouched — used by the raw-mode preview to let the observer click a
 * mis-recognised (or unrecognized) star name and pick the right one.
 *
 * `plusLevel` and `matchLen` are {@link ParsedRaw.plusLevel} / `matchLen` from
 * the original parse: `matchLen` is how many characters of the normalised,
 * "+"-stripped line the old star token consumed (0 when nothing matched, in
 * which case the new token is simply prepended to the line's content).
 */
export function replaceStarToken(
  line: string,
  plusLevel: number,
  matchLen: number,
  newToken: string,
): string {
  const hashIdx = line.indexOf("#");
  const noteSuffix = hashIdx >= 0 ? line.slice(hashIdx) : "";
  const body = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
  let s = body.trim().toLowerCase().replace(/\s+/g, "");
  for (let i = 0; i < plusLevel && s.startsWith("+"); i++) s = s.slice(1);
  const rest = s.slice(matchLen);
  return "+".repeat(plusLevel) + newToken + rest + noteSuffix;
}

export type RawFields = {
  a: string | null;
  pasos_a: number | null;
  pasos_b: number | null;
  b: string | null;
  limit_value: string | null;
  ut_time: string | null;
};

/**
 * Inverse of the data-parsing half of {@link parseRawLine}: turn a set of
 * fields back into the compact text that parses back to them. Used to
 * rebuild a line after the observer edits a single value (A, Paso A, Paso B,
 * B, Limit or UT) in the raw-mode preview table.
 */
export function serializeRawFields(f: RawFields): string {
  if (f.limit_value) {
    const body = f.limit_value.replace(/^</, "");
    const ut = f.ut_time ? f.ut_time.replace(":", "") : "";
    return "<" + body + ut;
  }
  const left = (f.a ?? "") + (f.pasos_a != null ? String(f.pasos_a) : "");
  const rightBody = (f.pasos_b != null ? String(f.pasos_b) : "") + (f.b ?? "");
  const ut = f.ut_time ? f.ut_time.replace(":", "") : "";
  const right = rightBody + ut;
  return right ? left + "v" + right : left;
}

/**
 * Rewrite the paso/UT/limit data on one raw-text line, keeping the star name
 * (and any "+" prefix) exactly as typed — the field-editing counterpart of
 * {@link replaceStarToken}. Same `plusLevel`/`matchLen` convention.
 */
export function replaceRawLineFields(
  line: string,
  plusLevel: number,
  matchLen: number,
  fields: RawFields,
): string {
  const hashIdx = line.indexOf("#");
  const noteSuffix = hashIdx >= 0 ? line.slice(hashIdx) : "";
  const body = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
  let s = body.trim().toLowerCase().replace(/\s+/g, "");
  for (let i = 0; i < plusLevel && s.startsWith("+"); i++) s = s.slice(1);
  const starPart = s.slice(0, matchLen);
  return "+".repeat(plusLevel) + starPart + serializeRawFields(fields) + noteSuffix;
}

/** Rewrite (or clear) the trailing "#note" on one raw-text line. */
export function replaceRawLineNote(line: string, newNote: string): string {
  const hashIdx = line.indexOf("#");
  const body = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
  const trimmed = newNote.trim();
  return trimmed ? `${body}#${trimmed}` : body;
}

const dashToDot = (v: string | null) => (v ? v.replace(/-/g, ".") : v);

const utFromDigits = (d: string) =>
  d.length === 3 ? d[0] + ":" + d.slice(1) : d.slice(0, 2) + ":" + d.slice(2);

/** Parse a single raw line. Returns null when no star could be resolved. */
export function parseRawLine(line: string, index: StarMatchIndex): ParsedRaw | null {
  // Split off note at '#' (kept with original casing/spaces)
  const hashIdx = line.indexOf("#");
  const note = hashIdx >= 0 ? line.slice(hashIdx + 1).trim() || null : null;
  const body = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
  let s = body.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  // Leading "+" markers → another entry for the previous star
  let plusLevel = 0;
  while (s.startsWith("+")) { plusLevel++; s = s.slice(1); }
  // a lone "+" without a body – ignore
  if (plusLevel > 0 && !s) return null;

  // With a "+" prefix the star name may be omitted (the caller reuses the
  // previous one), so a failed match is not fatal there.
  const match = matchStarToken(s, index, { fuzzy: plusLevel === 0 });
  if (!match && plusLevel === 0) return null;
  const starToken = match?.token ?? "";
  const correction = match?.correction;
  const matchLen = match?.consumed ?? 0;
  const rest = s.slice(matchLen);

  if (!rest) {
    return {
      starToken, a: null, pasos_a: null, pasos_b: null, b: null,
      ut_time: null, limit_value: null, note, plusLevel, correction, matchLen,
    };
  }

  // Limit line: starts with '<'
  if (rest.startsWith("<")) {
    const inner = rest.slice(1);
    let limitBody: string | null = inner || null;
    let ut_time: string | null = null;
    const m = /^(.+?)(\d{3,4})$/.exec(inner);
    if (m && /[.\-]/.test(m[1])) {
      limitBody = m[1];
      ut_time = utFromDigits(m[2]);
    }
    const normalized = dashToDot(limitBody);
    return {
      starToken,
      a: null, pasos_a: null, pasos_b: null, b: null,
      ut_time,
      limit_value: normalized ? "<" + normalized : null,
      note, plusLevel, correction, matchLen,
    };
  }

  const vIdx = rest.search(/v/i);
  const left = vIdx >= 0 ? rest.slice(0, vIdx) : rest;
  const right = vIdx >= 0 ? rest.slice(vIdx + 1) : "";
  // left -> A, pasoA (last single digit)
  let a: string | null = null;
  let pasos_a: number | null = null;
  if (left) {
    const lm = /^(.*)(\d)$/.exec(left);
    if (lm) {
      a = lm[1] || null;
      pasos_a = parseInt(lm[2], 10);
    } else {
      a = left;
    }
  }
  // right -> pasoB (first single digit), B, UT (trailing 3-4 digits)
  let pasos_b: number | null = null;
  let b: string | null = null;
  let ut_time: string | null = null;
  if (right) {
    let inner = right;
    const um = /^(.*)(\d{4})$/.exec(inner) ?? /^(.*)(\d{3})$/.exec(inner);
    if (um) {
      inner = um[1];
      ut_time = utFromDigits(um[2]);
    }
    const pm = /^(\d)(.*)$/.exec(inner);
    if (pm) {
      pasos_b = parseInt(pm[1], 10);
      b = pm[2] || null;
    } else if (inner) {
      b = inner;
    }
  }
  return {
    starToken, a: dashToDot(a), pasos_a, pasos_b, b: dashToDot(b),
    ut_time, limit_value: null, note, plusLevel, correction, matchLen,
  };
}
