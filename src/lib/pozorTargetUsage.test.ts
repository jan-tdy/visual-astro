import { beforeEach, describe, expect, it } from "vitest";
import { mostUsedTargets, readTargetUsage, recordTargetUsage } from "./pozorTargetUsage";

describe("POZOR target usage", () => {
  beforeEach(() => localStorage.clear());

  it("ranks stars by their use across planning tabs, not tab visits", () => {
    recordTargetUsage("observer", ["star-a", "star-b"]);
    recordTargetUsage("observer", ["star-b"]);
    expect(mostUsedTargets([{ id: "star-a" }, { id: "star-b" }, { id: "unused" }], readTargetUsage("observer")))
      .toEqual([{ id: "star-b" }, { id: "star-a" }]);
  });

  it("keeps observers separate and excludes targets outside the active catalogue", () => {
    recordTargetUsage("observer-a", ["other-catalogue", "star"]);
    expect(readTargetUsage("observer-b")).toEqual({});
    expect(mostUsedTargets([{ id: "star" }], readTargetUsage("observer-a"))).toEqual([{ id: "star" }]);
  });

  it("counts each displayed target only once per usage event", () => {
    recordTargetUsage("observer", ["star", "star"]);
    expect(readTargetUsage("observer")).toEqual({ star: 1 });
  });
});