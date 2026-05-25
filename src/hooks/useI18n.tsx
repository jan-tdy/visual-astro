import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "sk" | "en";

const dict = {
  sk: {
    "nav.sessions": "Sessions",
    "nav.catalog": "Katalóg",
    "nav.prom": "Prom",
    "nav.graphs": "Grafy",
    "nav.settings": "Nastavenia",
    "nav.info": "Info",
    "nav.logout": "Odhlásiť",
    "sessions.title": "Pozorovacie session",
    "sessions.subtitle": "Záznamy odhadov magnitúd premenných hviezd",
    "sessions.newFromLast": "Nová z poslednej",
    "sessions.newFromFavorite": "Nová z obľúbenej",
    "sessions.empty": "Prázdna",
    "sessions.none": "Zatiaľ žiadne session.",
    "sessions.observations": "pozorovaní",
    "sessions.favoriteAdd": "Pridať do obľúbených",
    "sessions.favoriteRemove": "Odobrať z obľúbených",
    "sessions.delete": "Vymazať",
    "sessions.deleteTitle": "Vymazať session?",
    "sessions.deleteDesc": "Táto akcia natrvalo odstráni session vrátane všetkých pozorovaní. Tento krok sa nedá vrátiť späť.",
    "sessions.cancel": "Zrušiť",
    "sessions.favProtected": "Obľúbenú session nie je možné vymazať",
    "sessions.favAdded": "Pridané do obľúbených",
    "sessions.favRemoved": "Odobraté z obľúbených",
    "sessions.noFavorite": "Nemáš nastavenú obľúbenú session",
    "lang.label": "Jazyk",
  },
  en: {
    "nav.sessions": "Sessions",
    "nav.catalog": "Catalog",
    "nav.prom": "Prom",
    "nav.graphs": "Graphs",
    "nav.settings": "Settings",
    "nav.info": "Info",
    "nav.logout": "Sign out",
    "sessions.title": "Observing sessions",
    "sessions.subtitle": "Visual magnitude estimates of variable stars",
    "sessions.newFromLast": "New from last",
    "sessions.newFromFavorite": "New from favorite",
    "sessions.empty": "Empty",
    "sessions.none": "No sessions yet.",
    "sessions.observations": "observations",
    "sessions.favoriteAdd": "Add to favorites",
    "sessions.favoriteRemove": "Remove from favorites",
    "sessions.delete": "Delete",
    "sessions.deleteTitle": "Delete session?",
    "sessions.deleteDesc": "This will permanently remove the session and all its observations. This cannot be undone.",
    "sessions.cancel": "Cancel",
    "sessions.favProtected": "A favorite session cannot be deleted",
    "sessions.favAdded": "Added to favorites",
    "sessions.favRemoved": "Removed from favorites",
    "sessions.noFavorite": "No favorite session set",
    "lang.label": "Language",
  },
} as const;

type Key = keyof (typeof dict)["sk"];

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
    return stored === "en" || stored === "sk" ? stored : "sk";
  });
  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => setLangState(l);
  const t = (k: Key) => (dict[lang] as Record<string, string>)[k] ?? k;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}