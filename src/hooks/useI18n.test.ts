import { describe, it, expect } from "vitest";
import { dict } from "@/hooks/useI18n";

// Regression guard: the sk and en dictionaries drifted apart before (6 keys existed only
// in sk), which meant t() silently fell back from missing English text to raw Slovak text
// for English-language users. Keep the two key sets — and their {placeholder} tokens — in sync.

function placeholders(s: string): string[] {
  return [...new Set(s.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])].sort();
}

describe("i18n dictionary", () => {
  it("has the same set of keys in sk and en", () => {
    const skKeys = Object.keys(dict.sk).sort();
    const enKeys = Object.keys(dict.en).sort();
    expect(enKeys).toEqual(skKeys);
  });

  it("uses the same {placeholder} tokens in matching sk/en strings", () => {
    const mismatches: string[] = [];
    for (const key of Object.keys(dict.sk)) {
      const skVal = (dict.sk as Record<string, string>)[key];
      const enVal = (dict.en as Record<string, string>)[key];
      if (enVal === undefined) continue;
      const ps = placeholders(skVal);
      const pe = placeholders(enVal);
      if (JSON.stringify(ps) !== JSON.stringify(pe)) mismatches.push(key);
    }
    expect(mismatches).toEqual([]);
  });
});
