import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MAG_TOLERANCE } from "@/lib/magHistory";
import { DEFAULT_COMP_LABEL_THRESHOLD } from "@/lib/astro";

export interface PaperColumnCfg {
  visible: boolean;
  /** column width in mm on the printed/PDF sheet */
  widthMm: number;
}

export interface PaperTemplatePrefs {
  /** total ruled rows on the sheet (split across 1–2 side-by-side blocks per page) */
  rows: number;
  /** merge A / Paso A / Paso B / B into one free-write cell instead of four ruled ones */
  mergeMag: boolean;
  /** when mergeMag is on, also fold the Limit column into that merged cell */
  mergeLimit: boolean;
  columns: {
    star: PaperColumnCfg;
    a: PaperColumnCfg;
    pasoA: PaperColumnCfg;
    pasoB: PaperColumnCfg;
    b: PaperColumnCfg;
    /** used instead of a/pasoA/pasoB/b when mergeMag is on */
    mag: PaperColumnCfg;
    limit: PaperColumnCfg;
    ut: PaperColumnCfg;
    note: PaperColumnCfg;
  };
}

export interface UserPrefs {
  autofillUtNow: boolean;       // pri otvorení nového riadku predvyplniť aktuálny UT čas
  confirmDelete: boolean;        // pýtať potvrdenie pri mazaní v katalógoch
  autosaveDelayMs: number;       // oneskorenie auto-save (300–2000)
  defaultConstellation: string;  // predvolené súhvezdie po otvorení session
  magCheckEnabled: boolean;      // porovnávať magnitúdy s priemerom minulých sessions
  magCheckTolerance: number;     // o koľko mag sa smie líšiť bez upozornenia (0.2–5.0)
  compLabelThreshold: number;    // nad touto hodnotou je "A"/"B" bez desatinnej čiarky štítok hviezdy (÷10), nie magnitúda (15–40)
  openPortalAfterExport: {
    aavso: boolean;
    vsnet: boolean;
  };
  portalUrls: {
    aavso: string;
    vsnet: string;
  };
  paperTemplate: PaperTemplatePrefs;
}

const KEY = "user_prefs_v1";
export const SUBMISSION_PORTALS: Record<"aavso" | "vsnet", { url: string; label: string }> = {
  aavso: { url: "https://www.aavso.org/webobs/file/", label: "AAVSO WebObs (upload súboru)" },
  vsnet: { url: "https://vsnet.kusastro.kyoto-u.ac.jp/vsnet/", label: "VSNET (info o zaslaní pozorovaní)" },
};

const DEFAULT_PAPER_TEMPLATE: PaperTemplatePrefs = {
  rows: 100,
  mergeMag: false,
  mergeLimit: false,
  columns: {
    star: { visible: true, widthMm: 16 },
    a: { visible: true, widthMm: 8 },
    pasoA: { visible: true, widthMm: 7 },
    pasoB: { visible: true, widthMm: 7 },
    b: { visible: true, widthMm: 8 },
    mag: { visible: true, widthMm: 30 },
    limit: { visible: true, widthMm: 10 },
    ut: { visible: true, widthMm: 10 },
    note: { visible: true, widthMm: 16 },
  },
};

const DEFAULTS: UserPrefs = {
  autofillUtNow: false,
  confirmDelete: true,
  autosaveDelayMs: 600,
  defaultConstellation: "AND",
  magCheckEnabled: true,
  magCheckTolerance: DEFAULT_MAG_TOLERANCE,
  compLabelThreshold: DEFAULT_COMP_LABEL_THRESHOLD,
  openPortalAfterExport: { aavso: false, vsnet: false },
  portalUrls: {
    aavso: SUBMISSION_PORTALS.aavso.url,
    vsnet: SUBMISSION_PORTALS.vsnet.url,
  },
  paperTemplate: DEFAULT_PAPER_TEMPLATE,
};

function read(): UserPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      openPortalAfterExport: { ...DEFAULTS.openPortalAfterExport, ...(parsed.openPortalAfterExport ?? {}) },
      portalUrls: { ...DEFAULTS.portalUrls, ...(parsed.portalUrls ?? {}) },
      paperTemplate: {
        ...DEFAULT_PAPER_TEMPLATE,
        ...(parsed.paperTemplate ?? {}),
        columns: { ...DEFAULT_PAPER_TEMPLATE.columns, ...(parsed.paperTemplate?.columns ?? {}) },
      },
    };
  } catch {
    return DEFAULTS;
  }
}

export function getPrefs(): UserPrefs {
  return read();
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState<UserPrefs>(() => read());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPrefsState(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  // Sync portal prefs from Supabase profile on mount (overrides localStorage cache)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("open_portal_after_export, portal_urls")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setPrefsState((cur) => {
        const next = {
          ...cur,
          openPortalAfterExport: {
            ...DEFAULTS.openPortalAfterExport,
            ...((data as any).open_portal_after_export ?? {}),
          },
          portalUrls: {
            ...DEFAULTS.portalUrls,
            ...((data as any).portal_urls ?? {}),
          },
        };
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, []);
  const update = (patch: Partial<UserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
    // Persist portal-related prefs to Supabase profile
    if (patch.openPortalAfterExport || patch.portalUrls) {
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) return;
        const dbPatch: { open_portal_after_export?: any; portal_urls?: any } = {};
        if (patch.openPortalAfterExport) dbPatch.open_portal_after_export = next.openPortalAfterExport;
        if (patch.portalUrls) dbPatch.portal_urls = next.portalUrls;
        await supabase.from("profiles").update(dbPatch as any).eq("user_id", u.user.id);
      })();
    }
  };
  return { prefs, update };
}