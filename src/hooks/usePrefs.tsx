import { useEffect, useState } from "react";

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
  const update = (patch: Partial<UserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  return { prefs, update };
}