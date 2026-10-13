import { describe, it, expect, beforeEach } from "vitest";
import { getPromTable, importPromJSON, PromImportShapeError } from "@/lib/promStore";

const KEY = "prom_overrides_v1";

describe("importPromJSON", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it("rejects an empty object instead of tombstoning every bundled star", () => {
    const before = getPromTable();
    expect(Object.keys(before).length).toBeGreaterThan(0);

    expect(() => importPromJSON("{}")).toThrow(PromImportShapeError);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getPromTable()).toEqual(before);
  });

  it("rejects a JSON array", () => {
    expect(() => importPromJSON("[]")).toThrow(PromImportShapeError);
  });

  it("rejects a star whose letters are not a magnitude map", () => {
    expect(() => importPromJSON(JSON.stringify({ "Some Star": "not an object" }))).toThrow(
      PromImportShapeError,
    );
  });

  it("rejects a magnitude that is not a finite number", () => {
    expect(() => importPromJSON(JSON.stringify({ "Some Star": { a: "9.4" } }))).toThrow(
      PromImportShapeError,
    );
  });

  it("still propagates plain JSON.parse errors for malformed JSON", () => {
    expect(() => importPromJSON("not json")).toThrow(SyntaxError);
  });

  it("accepts a well-formed table and tombstones bundled stars it omits", () => {
    const before = getPromTable();
    const [someBundledName] = Object.keys(before);

    importPromJSON(JSON.stringify({ "My Custom Star": { a: 9.1, b: 9.6 } }));

    const after = getPromTable();
    expect(after["My Custom Star"]).toEqual({ a: 9.1, b: 9.6 });
    expect(after[someBundledName]).toBeUndefined();
  });
});
