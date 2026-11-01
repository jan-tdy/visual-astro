import { describe, it, expect } from "vitest";
import {
  buildStarLookup, matchObjectName, formatPragueTime, pragueDateKey, pragueDateKeyToUtcNoon,
  formatUtHHMM, formatDuration,
  type MatchableStar,
} from "./japyscope";

const stars: MatchableStar[] = [
  { id: "1", name: "V445 Her", vsnet_code: "v445her", aavso_code: "V445 HER" },
  { id: "2", name: "RX And", vsnet_code: "rxand", aavso_code: "RX AND" },
  { id: "3", name: "SS Cyg", vsnet_code: "sscyg", aavso_code: "SS CYG" },
];

describe("matchObjectName", () => {
  it("matches a compact catalog-style name exactly", () => {
    const lookup = buildStarLookup(stars);
    expect(matchObjectName("V445Her", lookup)?.id).toBe("1");
  });

  it("matches a name with spaces the way the catalog stores it", () => {
    const lookup = buildStarLookup(stars);
    expect(matchObjectName("RX And", lookup)?.id).toBe("2");
  });

  it("is case-insensitive", () => {
    const lookup = buildStarLookup(stars);
    expect(matchObjectName("ss cyg", lookup)?.id).toBe("3");
  });

  it("autocorrects a wrong constellation the same way RAW mode does", () => {
    const lookup = buildStarLookup(stars);
    // "V445Cyg" -> designation v445 matches exactly one star regardless of
    // the (wrong) constellation suffix.
    expect(matchObjectName("V445Cyg", lookup)?.id).toBe("1");
  });

  it("does not partially match a longer unrelated name", () => {
    const lookup = buildStarLookup(stars);
    // "RX Andromedae" must not silently resolve to "RX And" with the
    // trailing "romedae" discarded — there's no comparator-data tail to
    // justify a partial consume here, unlike a RAW-mode line.
    expect(matchObjectName("RX Andromedae", lookup)).toBeNull();
  });

  it("returns null for a name with no catalog match", () => {
    const lookup = buildStarLookup(stars);
    expect(matchObjectName("Totally Unknown Object", lookup)).toBeNull();
  });

  it("returns null for an empty name", () => {
    const lookup = buildStarLookup(stars);
    expect(matchObjectName("", lookup)).toBeNull();
  });
});

describe("time formatting", () => {
  it("formats Prague local time from a UTC instant (winter, UTC+1)", () => {
    expect(formatPragueTime("2026-01-15T21:30:00Z")).toBe("22:30");
  });

  it("formats Prague local time from a UTC instant (summer DST, UTC+2)", () => {
    expect(formatPragueTime("2026-07-15T21:30:00Z")).toBe("23:30");
  });

  it("formats the UT HH:MM the rest of the app expects for ut_time", () => {
    expect(formatUtHHMM("2026-07-15T21:30:00Z")).toBe("21:30");
  });

  it("buckets a late-night UTC event into the next Prague calendar day", () => {
    // 23:30 UTC in summer is already past midnight in Prague (UTC+2).
    expect(pragueDateKey("2026-07-15T23:30:00Z")).toBe("2026-07-16");
  });

  it("keeps an event on the same Prague calendar day when there's no rollover", () => {
    expect(pragueDateKey("2026-01-15T10:00:00Z")).toBe("2026-01-15");
  });
});

describe("pragueDateKeyToUtcNoon", () => {
  it("round-trips back to the same key in winter (UTC+1)", () => {
    expect(pragueDateKey(pragueDateKeyToUtcNoon("2026-01-15").toISOString())).toBe("2026-01-15");
  });

  it("round-trips back to the same key in summer DST (UTC+2)", () => {
    expect(pragueDateKey(pragueDateKeyToUtcNoon("2026-07-15").toISOString())).toBe("2026-07-15");
  });

  it("round-trips across a year boundary", () => {
    expect(pragueDateKey(pragueDateKeyToUtcNoon("2026-12-31").toISOString())).toBe("2026-12-31");
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:00:45Z")).toBe("45 s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:03:25Z")).toBe("3 min 25 s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration("2026-01-01T00:00:00Z", "2026-01-01T01:04:00Z")).toBe("1 h 04 min");
  });

  it("never goes negative for a clock skew where ended_at precedes started_at", () => {
    expect(formatDuration("2026-01-01T00:00:10Z", "2026-01-01T00:00:00Z")).toBe("0 s");
  });
});
