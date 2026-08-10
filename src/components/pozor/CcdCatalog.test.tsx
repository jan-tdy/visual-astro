import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CcdCatalog } from "./CcdCatalog";
import type { CcdTarget } from "./shared";

vi.mock("@/hooks/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "sk-SK", setLang: () => {} }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPlusActive: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const updateCalls: { id: string; sort_order: number }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: { sort_order: number }) => ({
        eq: async (_col: string, id: string) => {
          if (table === "ccd_targets") updateCalls.push({ id, sort_order: payload.sort_order });
          return { error: null };
        },
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

const target = (
  id: string,
  name: string,
  constellation: string,
  sort_order: number,
  filters: string | null = null,
): CcdTarget => ({
  id,
  catalog_id: "cat1",
  name,
  constellation,
  ra_hours: 1,
  dec_deg: 1,
  epoch_jd: null,
  period_days: null,
  filters,
  notes: null,
  sort_order,
});

const baseProps = {
  loading: false,
  catalogId: "cat1",
  catalogName: "Test",
  isOwnCatalog: true,
  ownCatalogsCount: 1,
  setCatalogId: () => {},
  reloadCatalogs: () => {},
};

describe("CcdCatalog reorder arrows (issue #43)", () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it("moves a target down past a sibling in a different constellation", async () => {
    // Each target sits alone in its own constellation — the exact shape that used to
    // leave the arrows with no same-constellation sibling to swap with.
    const targets: CcdTarget[] = [
      target("t1", "Alpha", "ANDROMEDA", 10),
      target("t2", "Beta", "BOOTES", 20),
      target("t3", "Gamma", "CYGNUS", 30),
    ];
    const reload = vi.fn();
    render(<CcdCatalog {...baseProps} targets={targets} reload={reload} />);

    fireEvent.click(screen.getAllByTitle("pozor.cat.down")[0]); // Alpha down, past Beta
    await waitFor(() => expect(reload).toHaveBeenCalled());

    const byId = Object.fromEntries(updateCalls.map((u) => [u.id, u.sort_order]));
    expect(byId.t1).toBeGreaterThan(byId.t2);
  });

  it("moves a target up past a sibling in a different constellation", async () => {
    const targets: CcdTarget[] = [
      target("t1", "Alpha", "ANDROMEDA", 10),
      target("t2", "Beta", "BOOTES", 20),
      target("t3", "Gamma", "CYGNUS", 30),
    ];
    const reload = vi.fn();
    render(<CcdCatalog {...baseProps} targets={targets} reload={reload} />);

    fireEvent.click(screen.getAllByTitle("pozor.cat.up")[2]); // Gamma up, past Beta
    await waitFor(() => expect(reload).toHaveBeenCalled());

    const byId = Object.fromEntries(updateCalls.map((u) => [u.id, u.sort_order]));
    expect(byId.t3).toBeLessThan(byId.t2);
  });

  it("under an active search filter, swaps with the visible neighbor rather than a hidden one", async () => {
    // t2 doesn't match the filter below, so it's hidden. Reordering must swap the two
    // *visible* rows (t1, t3) with each other — swapping t1 with the hidden t2 would
    // leave the on-screen list unchanged, which is exactly what issue #43 reported.
    const targets: CcdTarget[] = [
      target("t1", "Alpha", "ANDROMEDA", 10, "keep"),
      target("t2", "Beta", "BOOTES", 20, "skip"),
      target("t3", "Gamma", "CYGNUS", 30, "keep"),
    ];
    const reload = vi.fn();
    render(<CcdCatalog {...baseProps} targets={targets} reload={reload} />);

    fireEvent.change(screen.getByPlaceholderText("pozor.search"), { target: { value: "keep" } });
    expect(screen.getAllByTitle("pozor.cat.down")).toHaveLength(2);

    fireEvent.click(screen.getAllByTitle("pozor.cat.down")[0]); // Alpha down, past Gamma
    await waitFor(() => expect(reload).toHaveBeenCalled());

    const touchedIds = updateCalls.map((u) => u.id).sort();
    expect(touchedIds).toEqual(["t1", "t3"]); // t2 (hidden) must be untouched

    const byId = Object.fromEntries(updateCalls.map((u) => [u.id, u.sort_order]));
    expect(byId.t1).toBeGreaterThan(byId.t3);
  });

  it("does nothing when there is no visible neighbor to swap with", async () => {
    const targets: CcdTarget[] = [
      target("t1", "Alpha", "ANDROMEDA", 10, "keep"),
      target("t2", "Beta", "BOOTES", 20, "skip"),
    ];
    const reload = vi.fn();
    render(<CcdCatalog {...baseProps} targets={targets} reload={reload} />);

    fireEvent.change(screen.getByPlaceholderText("pozor.search"), { target: { value: "keep" } });
    expect(screen.getAllByTitle("pozor.cat.down")).toHaveLength(1);

    fireEvent.click(screen.getAllByTitle("pozor.cat.down")[0]);
    await new Promise((r) => setTimeout(r, 0));

    expect(updateCalls).toHaveLength(0);
    expect(reload).not.toHaveBeenCalled();
  });
});
