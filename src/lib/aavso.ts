// Client for the public AAVSO International Database (AID) delimited-export
// endpoint, used by the light curve comparator to pull observations for
// arbitrary stars directly from the browser (the endpoint sends
// Access-Control-Allow-Origin: *, so no proxy is needed).
export type AavsoObservation = {
  jd: number;
  mag: number;
  band: string;
  fainterThan: boolean;
  /** Observer's full name when AAVSO reports one, otherwise their observer code. */
  observer: string;
  /** e.g. "Visual", "CCD", "DSLR", "PEP"... */
  obsType: string;
};

// AAVSO's own submission picklist (view=api.bands, Picklist=1), plus "Vis." —
// the single most common band for this app's visual observers, which AAVSO
// itself flags Picklist=0 because it has its own separate visual-report form.
export const AAVSO_BANDS = ["Vis.", "V", "B", "R", "I", "U", "CV", "CR", "TG", "TB", "TR"];

const AAVSO_ENDPOINT = "https://vsx.aavso.org/index.php";
// A three-character delimiter is what AAVSO's own docs recommend — a plain
// comma or semicolon can appear inside the free-text comment field and would
// silently misalign every column after it.
const DELIMITER = "@@@";

/**
 * Parses the delimited text AAVSO returns from view=api.delim into observation rows.
 *
 * Throws when the response doesn't look like a delimited AAVSO export at all
 * (e.g. an HTML/plain-text error page returned with HTTP 200) so callers can
 * tell that apart from a well-formed response that legitimately has no rows.
 */
export function parseAavsoDelim(text: string): AavsoObservation[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("AAVSO returned an unexpected response");
  }
  const header = lines[0].split(DELIMITER).map((h) => h.trim());
  const jdIdx = header.indexOf("JD");
  const magIdx = header.indexOf("mag");
  const bandIdx = header.indexOf("band");
  const fainterIdx = header.indexOf("fainterThan");
  const byIdx = header.indexOf("by");
  const obsNameIdx = header.indexOf("obsName");
  const obsTypeIdx = header.indexOf("obsType");
  if (jdIdx === -1 || magIdx === -1) {
    throw new Error("AAVSO returned an unexpected response");
  }

  const col = (cols: string[], idx: number) => (idx >= 0 ? (cols[idx] ?? "").trim() : "");
  const out: AavsoObservation[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(DELIMITER);
    const jd = parseFloat(cols[jdIdx]);
    const mag = parseFloat(cols[magIdx]);
    if (!Number.isFinite(jd) || !Number.isFinite(mag)) continue;
    out.push({
      jd,
      mag,
      band: col(cols, bandIdx),
      fainterThan: fainterIdx >= 0 ? cols[fainterIdx]?.trim() === "1" : false,
      observer: col(cols, obsNameIdx) || col(cols, byIdx),
      obsType: col(cols, obsTypeIdx),
    });
  }
  return out.sort((a, b) => a.jd - b.jd);
}

// Guards against a hung request leaving the comparator's loading state
// spinning forever when the caller doesn't pass its own signal/timeout.
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Fetches AID observations for a star (AAVSO/VSX name or designation) within
 * a JD range. Always aborts after `DEFAULT_TIMEOUT_MS`; pass `signal` (e.g.
 * from an `AbortController` the caller owns) to also allow cancelling early,
 * such as when newer inputs make an in-flight request stale.
 */
export async function fetchAavsoObservations(
  ident: string,
  fromJd: number,
  toJd: number,
  band?: string,
  signal?: AbortSignal,
): Promise<AavsoObservation[]> {
  const params = new URLSearchParams({
    view: "api.delim",
    ident: ident.trim(),
    fromjd: String(fromJd),
    tojd: String(toJd),
    delimiter: DELIMITER,
  });
  if (band) params.set("band", band);
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const res = await fetch(`${AAVSO_ENDPOINT}?${params.toString()}`, {
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  });
  if (!res.ok) throw new Error(`AAVSO request failed (${res.status})`);
  return parseAavsoDelim(await res.text());
}
