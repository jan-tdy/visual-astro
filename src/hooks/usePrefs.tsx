import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserPrefs {
  autofillUtNow: boolean;       // pri otvorení nového riadku predvyplniť aktuálny UT čas
  confirmDelete: boolean;        // pýtať potvrdenie pri mazaní v katalógoch
  autosaveDelayMs: number;       // oneskorenie auto-save (300–2000)
  defaultConstellation: string;  // predvolené súhvezdie po otvorení session
  openPortalAfterExport: {
    aavso: boolean;
    vsnet: boolean;
    meduza: boolean;
  };
  portalUrls: {
    aavso: string;
    vsnet: string;
    meduza: string;
  };
}

const KEY = "user_prefs_v1";
export const SUBMISSION_PORTALS: Record<"aavso" | "vsnet" | "meduza", { url: string; label: string }> = {
  aavso: { url: "https://www.aavso.org/webobs/file/", label: "AAVSO WebObs (upload súboru)" },
  vsnet: { url: "https://vsnet.kusastro.kyoto-u.ac.jp/vsnet/", label: "VSNET (info o zaslaní pozorovaní)" },
  meduza: { url: "http://var.astro.cz/en/", label: "MEDUZA / var.astro.cz" },
};

const DEFAULTS: UserPrefs = {
  autofillUtNow: false,
  confirmDelete: true,
  autosaveDelayMs: 600,
  defaultConstellation: "AND",
  openPortalAfterExport: { aavso: false, vsnet: false, meduza: false },
  portalUrls: {
    aavso: SUBMISSION_PORTALS.aavso.url,
    vsnet: SUBMISSION_PORTALS.vsnet.url,
    meduza: SUBMISSION_PORTALS.meduza.url,
  },
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
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
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
    } catch {}
    // Persist portal-related prefs to Supabase profile
    if (patch.openPortalAfterExport || patch.portalUrls) {
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) return;
        const dbPatch: Record<string, any> = {};
        if (patch.openPortalAfterExport) dbPatch.open_portal_after_export = next.openPortalAfterExport;
        if (patch.portalUrls) dbPatch.portal_urls = next.portalUrls;
        await supabase.from("profiles").update(dbPatch).eq("user_id", u.user.id);
      })();
    }
  };
  return { prefs, update };
}