import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import {
  Tolgee,
  DevTools,
  TolgeeProvider,
  FormatSimple,
  useTolgee,
  useTranslate,
} from "@tolgee/react";

export const SUPPORTED_LANGS = [
  { code: "sk", label: "Slovenčina" },
  { code: "en", label: "English" },
  { code: "cs", label: "Čeština" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "pl", label: "Polski" },
  { code: "nl", label: "Nederlands" },
  { code: "hu", label: "Magyar" },
  { code: "uk", label: "Українська" },
  { code: "ru", label: "Русский" },
] as const;

type Lang = (typeof SUPPORTED_LANGS)[number]["code"];

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
    "search.placeholder": "Hľadať session, hviezdy…",
    "search.empty": "Nič sa nenašlo.",
    "search.sessions": "Sessions",
    "search.stars": "Hviezdy",
    "search.untitled": "(bez názvu)",
    "auth.title": "Visual Astro",
    "auth.subtitle": "Pozorovateľský denník premenných hviezd",
    "auth.email": "E-mail",
    "auth.password": "Heslo",
    "auth.signin": "Prihlásiť",
    "auth.signup": "Registrovať",
    "auth.toSignup": "Vytvoriť nový účet",
    "auth.toSignin": "Mám už účet, prihlásiť",
    "auth.created": "Účet vytvorený. Skontroluj e-mail.",
    "auth.error": "Chyba pri prihlásení",
    "editor.back": "Sessions",
    "editor.name": "Názov session",
    "editor.namePlaceholder": "napr. Jasná obloha v Modre",
    "editor.date": "Dátum (UT, večer)",
    "editor.jd": "JD (kompletný)",
    "editor.obs": "Obs",
    "editor.filled": "Vyplnené",
    "editor.paperTemplate": "Vzor papiera",
    "editor.paperImport": "Import z papiera",
    "editor.exportJson": "Export JSON",
    "editor.importJson": "Import JSON",
    "about.title": "Visual Astro — denník vizuálneho pozorovania",
    "about.subtitle": "Moderná náhrada tabuľky Reducciones.ods — odhady magnitúd premenných hviezd Argelanderovou metódou s exportmi do VSNET, AAVSO a MEDUZA.",
    "about.openSessions": "Otvoriť sessions",
    "about.openCatalog": "Katalóg",
    "about.howItWorks": "Ako to funguje",
    "about.language": "Jazyk rozhrania",
    "about.languageDesc": "V hlavičke vpravo klikni na tlačidlo SK / EN a prepneš medzi slovenčinou a angličtinou. Tvoja voľba sa uloží lokálne do prehliadača.",
    "about.settingsCatalog": "Nastavenia & katalóg",
    "about.ocrTitle": "OCR & AI skenovanie",
    "about.ocrDesc": "Automatické rozpoznávanie ručne písaných tabuliek pomocou AI — odfotíš svoj papierový záznam a aplikácia sama vyplní hviezdy, hodnoty A/Paso/B aj UT časy. V pláne Plus 15 skenov denne, vo Free pláne 5 skenov denne.",
    "about.plans": "Plány & fakturácia",
    "about.howToUse": "Návod — ako používať",
    "about.tech": "Ako to funguje technicky",
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
    "search.placeholder": "Search sessions, stars…",
    "search.empty": "No results.",
    "search.sessions": "Sessions",
    "search.stars": "Stars",
    "search.untitled": "(untitled)",
    "auth.title": "Visual Astro",
    "auth.subtitle": "Variable-star observing log",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.signin": "Sign in",
    "auth.signup": "Sign up",
    "auth.toSignup": "Create a new account",
    "auth.toSignin": "I already have an account",
    "auth.created": "Account created. Check your email.",
    "auth.error": "Sign-in error",
    "editor.back": "Sessions",
    "editor.name": "Session name",
    "editor.namePlaceholder": "e.g. Clear sky in Modra",
    "editor.date": "Date (UT, evening)",
    "editor.jd": "JD (full)",
    "editor.obs": "Obs",
    "editor.filled": "Filled",
    "editor.paperTemplate": "Paper template",
    "editor.paperImport": "Import from paper",
    "editor.exportJson": "Export JSON",
    "editor.importJson": "Import JSON",
    "about.title": "Visual Astro — visual observing log",
    "about.subtitle": "A modern replacement for the Reducciones.ods spreadsheet — visual magnitude estimates of variable stars using the Argelander method, with VSNET, AAVSO and MEDUZA exports.",
    "about.openSessions": "Open sessions",
    "about.openCatalog": "Catalog",
    "about.howItWorks": "How it works",
    "about.language": "Interface language",
    "about.languageDesc": "Click the SK / EN button in the header to switch between Slovak and English. Your choice is stored in the browser.",
    "about.settingsCatalog": "Settings & catalog",
    "about.ocrTitle": "OCR & AI scanning",
    "about.ocrDesc": "Automatic recognition of hand-written paper tables using AI — take a photo of your paper log and the app fills in stars, A/Paso/B values and UT times. Plus plan: 15 scans/day, Free plan: 5 scans/day.",
    "about.plans": "Plans & billing",
    "about.howToUse": "How to use",
    "about.tech": "How it works technically",
  },
} as const;

type Key = keyof (typeof dict)["sk"];

const TOLGEE_API_KEY = "tgpak_gmzdcnrql5yg6ndjobxtm5jxgyyg2ntomq4gczrqmjrwwobzojxa";
const TOLGEE_API_URL = "https://app.tolgee.io";

// Map our short app lang codes to Tolgee project language tags
const TOLGEE_MAP: Record<Lang, string> = {
  sk: "sk-SK",
  en: "en",
  cs: "cs-CZ",
  de: "de-DE",
  es: "es-ES",
  fr: "fr",
  it: "it",
  pl: "pl",
  nl: "nl",
  hu: "hu",
  uk: "uk",
  ru: "ru",
};
const toTolgee = (l: string) => TOLGEE_MAP[l as Lang] ?? "en";
const fromTolgee = (t: string): Lang => {
  const entry = (Object.entries(TOLGEE_MAP) as [Lang, string][]).find(([, v]) => v === t);
  return entry?.[0] ?? (t.split("-")[0] as Lang) ?? "sk";
};

const storedLang = (): Lang => {
  if (typeof window === "undefined") return "sk";
  const s = localStorage.getItem("lang") || "sk";
  return (SUPPORTED_LANGS.some((l) => l.code === s) ? s : "sk") as Lang;
};

const tolgee = Tolgee()
  .use(DevTools())
  .use(FormatSimple())
  .init({
    language: toTolgee(storedLang()),
    defaultLanguage: "sk-SK",
    fallbackLanguage: "en",
    availableLanguages: SUPPORTED_LANGS.map((l) => toTolgee(l.code)),
    apiKey: TOLGEE_API_KEY,
    apiUrl: TOLGEE_API_URL,
    staticData: {
      "sk-SK": dict.sk as unknown as Record<string, string>,
      en: dict.en as unknown as Record<string, string>,
    },
  });

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key | string) => string;
}

const I18nCtx = createContext<Ctx | null>(null);

function InnerProvider({ children }: { children: ReactNode }) {
  const tg = useTolgee(["language"]);
  const { t: tTrans } = useTranslate();
  const lang = fromTolgee(tg.getLanguage() || "sk-SK");

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (l: Lang) => {
        tg.changeLanguage(toTolgee(l));
      },
      t: (k) => {
        const v = tTrans(k as string);
        if (v && v !== k) return v;
        // fallback to static dict
        const base = lang === "en" ? dict.en : dict.sk;
        return (
          (base as Record<string, string>)[k as string] ??
          (dict.sk as Record<string, string>)[k as string] ??
          (k as string)
        );
      },
    }),
    [lang, tg, tTrans],
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <TolgeeProvider tolgee={tolgee} fallback="Loading…">
      <InnerProvider>{children}</InnerProvider>
    </TolgeeProvider>
  );
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}