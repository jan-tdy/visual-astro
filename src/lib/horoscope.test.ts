import { describe, it, expect } from "vitest";
import { hashString, pickDeterministic } from "@/lib/horoscope";

describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("Big Blue|collimation")).toBe(hashString("Big Blue|collimation"));
  });
  it("differs for different input (no trivial collisions for these cases)", () => {
    expect(hashString("Big Blue|collimation")).not.toBe(hashString("Big Blue|focus"));
  });
});

describe("pickDeterministic", () => {
  const arr = ["a", "b", "c", "d"];

  it("always returns the same element for the same seed+salt", () => {
    const first = pickDeterministic(arr, "Big Blue:2026-01-01", "luck");
    for (let i = 0; i < 10; i++) {
      expect(pickDeterministic(arr, "Big Blue:2026-01-01", "luck")).toBe(first);
    }
  });

  it("changes when the day changes (seed includes the date)", () => {
    const results = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      results.add(pickDeterministic(arr, `Big Blue:2026-01-${String(day).padStart(2, "0")}`, "luck"));
    }
    // Over 28 days, a 4-item list should produce more than one distinct pick.
    expect(results.size).toBeGreaterThan(1);
  });

  it("always returns an element of the array", () => {
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(pickDeterministic(arr, `seed-${i}`, "salt"));
    }
  });
});
