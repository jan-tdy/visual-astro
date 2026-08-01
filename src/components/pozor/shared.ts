import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { toast } from "sonner";
import {
  DEFAULT_LOCATION_KEY,
  DEFAULT_MIN_ALTITUDE,
  getLocation,
  type PozorLocation,
} from "@/lib/pozor";

export interface CcdTarget {
  id: string;
  catalog_id: string;
  name: string;
  constellation: string;
  ra_hours: number;
  dec_deg: number;
  epoch_jd: number | null;
  period_days: number | null;
  filters: string | null;
  notes: string | null;
  sort_order: number;
}

export const EMPTY_TARGET: Omit<CcdTarget, "id"> = {
  catalog_id: "",
  name: "",
  constellation: "",
  ra_hours: 0,
  dec_deg: 0,
  epoch_jd: null,
  period_days: null,
  filters: null,
  notes: null,
  sort_order: 0,
};

export const sortTargets = (items: CcdTarget[]) =>
  [...items].sort(
    (a, b) =>
      a.constellation.localeCompare(b.constellation) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

/** Load the active CCD catalogue's targets (independent of the visual `stars` table). */
export function useCcdTargets(catalogId: string) {
  const [targets, setTargets] = useState<CcdTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!catalogId) {
      setTargets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchAllRows<CcdTarget>((from, to) =>
      supabase
        .from("ccd_targets")
        .select("id,catalog_id,name,constellation,ra_hours,dec_deg,epoch_jd,period_days,filters,notes,sort_order")
        .eq("catalog_id", catalogId)
        .order("constellation")
        .order("sort_order")
        .range(from, to),
    );
    if (error) toast.error(error.message);
    setTargets(sortTargets(data));
    setLoading(false);
  }, [catalogId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { targets, loading, reload, setTargets };
}

export interface CcdCatalogInfo {
  id: string;
  name: string;
  sort_order: number;
  user_id: string;
  is_default: boolean;
}

const ACTIVE_CATALOG_KEY = "pozor_active_catalog_v1";

/** Load the user's CCD catalogues, auto-creating a first one if none exist yet. */
export function useCcdCatalogs() {
  const [catalogs, setCatalogs] = useState<CcdCatalogInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_CATALOG_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const reload = useCallback(async () => {
    setLoading(true);
    // RLS also returns the shared default catalog here (see the ccd_catalogs_default_sharing
    // migration), so a user without catalogs of their own sees it instead of getting a fresh
    // empty duplicate below.
    const { data, error } = await supabase
      .from("ccd_catalogs")
      .select("id,name,sort_order,user_id,is_default")
      .order("sort_order")
      .order("name");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    let list = data ?? [];
    if (list.length === 0) {
      const { data: created, error: createErr } = await supabase
        .from("ccd_catalogs")
        .insert({ name: "Katalóg 1", sort_order: 0 })
        .select("id,name,sort_order,user_id,is_default")
        .single();
      if (createErr) {
        toast.error(createErr.message);
        setLoading(false);
        return;
      }
      if (created) list = [created];
    }
    setCatalogs(list);
    setActiveId((prev) => (prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    try {
      localStorage.setItem(ACTIVE_CATALOG_KEY, activeId);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  return { catalogs, loading, reload, activeId, setActiveId };
}

const SETTINGS_KEY = "pozor_settings_v1";

export interface PozorSettings {
  locationKey: string;
  minAltitude: number;
}

function readSettings(): PozorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        locationKey: typeof p.locationKey === "string" ? p.locationKey : DEFAULT_LOCATION_KEY,
        minAltitude: Number.isFinite(p.minAltitude) ? p.minAltitude : DEFAULT_MIN_ALTITUDE,
      };
    }
  } catch {
    /* ignore */
  }
  return { locationKey: DEFAULT_LOCATION_KEY, minAltitude: DEFAULT_MIN_ALTITUDE };
}

/** Location + minimum altitude, persisted per browser. */
export function usePozorSettings() {
  const [settings, setSettings] = useState<PozorSettings>(readSettings);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);
  const location: PozorLocation = getLocation(settings.locationKey);
  return { settings, setSettings, location };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Chart palette for multi-target curves — semantic tokens only. */
export const CURVE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-4, var(--primary)))",
  "hsl(var(--chart-5, var(--accent)))",
];