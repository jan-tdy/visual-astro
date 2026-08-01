import { createContext, useContext, useState, type ReactNode } from "react";

export type AppMode = "visual" | "ccd";

const KEY = "app_mode_v1";

interface AppModeContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextValue>({
  mode: "visual",
  setMode: () => {},
});

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      return localStorage.getItem(KEY) === "ccd" ? "ccd" : "visual";
    } catch {
      return "visual";
    }
  });

  const setMode = (m: AppMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
  };

  return <AppModeContext.Provider value={{ mode, setMode }}>{children}</AppModeContext.Provider>;
}

export const useAppMode = () => useContext(AppModeContext);
