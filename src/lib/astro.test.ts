import { describe, it, expect } from "vitest";
import { parseLimitMagnitude } from "@/lib/astro";

describe("parseLimitMagnitude", () => {
  it("parses a plain fainter-than string", () => {
    expect(parseLimitMagnitude("<14.9")).toBe(14.9);
  });

  it("parses without the leading '<'", () => {
    expect(parseLimitMagnitude("12.3")).toBe(12.3);
  });

  it("handles surrounding whitespace", () => {
    expect(parseLimitMagnitude(" < 9.5 ")).toBe(9.5);
  });

  it("returns null for empty or missing input", () => {
    expect(parseLimitMagnitude(null)).toBeNull();
    expect(parseLimitMagnitude(undefined)).toBeNull();
    expect(parseLimitMagnitude("")).toBeNull();
  });

  it("returns null when no number is present", () => {
    expect(parseLimitMagnitude("<")).toBeNull();
    expect(parseLimitMagnitude("n/a")).toBeNull();
  });
});
