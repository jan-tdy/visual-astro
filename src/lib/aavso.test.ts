import { describe, it, expect } from "vitest";
import { parseAavsoDelim } from "@/lib/aavso";

const HEADER =
  "JD@@@mag@@@uncert@@@band@@@by@@@comCode@@@compStar1@@@compStar2@@@charts@@@comment@@@transformed@@@airmass@@@val@@@cmag@@@kmag@@@starName@@@obsAffil@@@mtype@@@adsRef@@@digitizer@@@credit@@@obsID@@@fainterThan@@@obsType@@@software@@@obsName@@@obsCountry";

describe("parseAavsoDelim", () => {
  it("returns no rows for a header-only response (unknown star)", () => {
    expect(parseAavsoDelim(HEADER)).toEqual([]);
  });

  it("parses JD, mag, band and fainterThan from a real row", () => {
    const row =
      "2459990.73028@@@11.708@@@0.014@@@V@@@DUBF@@@@@@000-BCP-198@@@000-BCP-217@@@X28034BQL@@@a comment, with a comma@@@0@@@-10.2@@@Z@@@17.575@@@17.295@@@SS CYG@@@VVS@@@STD@@@@@@@@@@@@1298154746@@@0@@@CCD@@@LESVEPHOTOMETRY V1.2.0.95@@@Dubois, Franky@@@BE";
    const rows = parseAavsoDelim(`${HEADER}\n${row}`);
    expect(rows).toEqual([{ jd: 2459990.73028, mag: 11.708, band: "V", fainterThan: false }]);
  });

  it("flags fainterThan=1 rows as upper limits", () => {
    const row = HEADER.split("@@@")
      .map((col) => {
        if (col === "JD") return "2459992.5";
        if (col === "mag") return "14.9";
        if (col === "fainterThan") return "1";
        return "";
      })
      .join("@@@");
    const rows = parseAavsoDelim(`${HEADER}\n${row}`);
    expect(rows).toEqual([{ jd: 2459992.5, mag: 14.9, band: "", fainterThan: true }]);
  });

  it("skips rows with a non-numeric JD or magnitude", () => {
    const bad = HEADER.split("@@@")
      .map((col) => (col === "JD" ? "not-a-date" : col === "mag" ? "12.0" : ""))
      .join("@@@");
    expect(parseAavsoDelim(`${HEADER}\n${bad}`)).toEqual([]);
  });

  it("sorts rows by JD ascending", () => {
    const make = (jd: string) =>
      HEADER.split("@@@")
        .map((col) => (col === "JD" ? jd : col === "mag" ? "10" : ""))
        .join("@@@");
    const rows = parseAavsoDelim(`${HEADER}\n${make("2460002")}\n${make("2460001")}`);
    expect(rows.map((r) => r.jd)).toEqual([2460001, 2460002]);
  });

  it("returns no rows for empty input", () => {
    expect(parseAavsoDelim("")).toEqual([]);
  });
});
