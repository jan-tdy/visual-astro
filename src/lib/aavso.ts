// Client for the public AAVSO International Database (AID) delimited-export
// endpoint, used by the light curve comparator to pull observations for
// arbitrary stars directly from the browser (the endpoint sends
// Access-Control-Allow-Origin: *, so no proxy is needed).
export type AavsoObservation = {
  jd: number;
  mag: number;
  band: string;
  fainterThan: boolean;
};

const AAVSO_ENDPOINT = "https://vsx.aavso.org/index.php";
// A three-character delimiter is what AAVSO's own docs recommend — a plain
// comma or semicolon can appear inside the free-text comment field and would
// silently misalign every column after it.
const DELIMITER = "@@@";

/** Parses the delimited text AAVSO returns from view=api.delim into observation rows. */
export function parseAavsoDelim(text: string): AavsoObservation[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(DELIMITER).map((h) => h.trim());
  const jdIdx = header.indexOf("JD");
  const magIdx = header.indexOf("mag");
  const bandIdx = header.indexOf("band");
  const fainterIdx = header.indexOf("fainterThan");
  if (jdIdx === -1 || magIdx === -1) return [];

  const out: AavsoObservation[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(DELIMITER);
    const jd = parseFloat(cols[jdIdx]);
    const mag = parseFloat(cols[magIdx]);
    if (!Number.isFinite(jd) || !Number.isFinite(mag)) continue;
    out.push({
      jd,
      mag,
      band: bandIdx >= 0 ? (cols[bandIdx] ?? "").trim() : "",
      fainterThan: fainterIdx >= 0 ? cols[fainterIdx]?.trim() === "1" : false,
    });
  }
  return out.sort((a, b) => a.jd - b.jd);
}

/** Fetches AID observations for a star (AAVSO/VSX name or designation) within a JD range. */
export async function fetchAavsoObservations(
  ident: string,
  fromJd: number,
  toJd: number,
): Promise<AavsoObservation[]> {
  const params = new URLSearchParams({
    view: "api.delim",
    ident: ident.trim(),
    fromjd: String(fromJd),
    tojd: String(toJd),
    delimiter: DELIMITER,
  });
  const res = await fetch(`${AAVSO_ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`AAVSO request failed (${res.status})`);
  return parseAavsoDelim(await res.text());
}
