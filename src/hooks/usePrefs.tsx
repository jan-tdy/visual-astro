import { useEffect, useState } from "react";

export interface UserPrefs {
  autofillUtNow: boolean;       // pri otvorení nového riadku predvyplniť aktuálny UT čas
  confirmDelete: boolean;        // pýtať potvrdenie pri mazaní v katalógoch
  autosaveDelayMs: number;       // oneskorenie auto-save (300–2000)
  defaultConstellation: string;  // predvolené súhvezdie po otvorení session
}

const KEY = "user_prefs_v1";
const DEFAULTS: UserPrefs = {
  autofillUtNow: false,
  confirmDelete: true,
  autosaveDelayMs: 600,
  defaultConstellation: "AND",
};

function read(): UserPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
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