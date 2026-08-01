import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useI18n, SUPPORTED_LANGS } from "@/hooks/useI18n";
import { useAppMode, type AppMode } from "@/hooks/useAppMode";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut, BookOpen, Settings as SettingsIcon, ListChecks, Info, Sun, Moon, Menu,
  Sparkles, BarChart3, Wrench, Clock, Star, Lock,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import logoUrl from "@/assets/visual-astro-logo.png";

interface NavLink {
  to: string;
  label: string;
  icon: any;
  locked?: boolean;
}

function ModeToggle({
  mode,
  setMode,
  labelVisual,
  labelCcd,
  className = "",
}: {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  labelVisual: string;
  labelCcd: string;
  className?: string;
}) {
  const btn = (m: AppMode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-2.5 py-1 rounded-full transition-colors ${
        mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex items-center rounded-full border border-border p-0.5 text-xs font-medium ${className}`}>
      {btn("visual", labelVisual)}
      {btn("ccd", labelCcd)}
    </div>
  );
}

export function AppHeader() {
  const { signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { mode, setMode } = useAppMode();
  const { isPlusActive } = useSubscription();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  // Keep the switch in sync when a Pozor/Tools (CCD) or Sessions/Catalog/Prom/Graphs
  // (Visual) URL is opened directly — e.g. a bookmark or link — instead of via the
  // switch itself. Settings/Info belong to both modes, so they don't force a change.
  useEffect(() => {
    const isCcdPath = loc.pathname.startsWith("/pozor") || loc.pathname === "/tools";
    const isVisualPath =
      loc.pathname === "/" ||
      loc.pathname.startsWith("/session") ||
      loc.pathname === "/catalog" ||
      loc.pathname === "/prom" ||
      loc.pathname === "/graphs";
    if (isCcdPath && mode !== "ccd") setMode("ccd");
    else if (isVisualPath && mode !== "visual") setMode("visual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  const link = (to: string, label: string, Icon: any, locked = false) => {
    const active = loc.pathname === to || (to === "/" && loc.pathname.startsWith("/session"));
    return (
      <Link
        key={to}
        to={to}
        onClick={() => setOpen(false)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" /> {label}
        {locked && <Lock className="h-3 w-3 opacity-60" />}
      </Link>
    );
  };

  const visualLinks: NavLink[] = [
    { to: "/", label: t("nav.sessions"), icon: ListChecks },
    { to: "/catalog", label: t("nav.catalog"), icon: BookOpen },
    { to: "/prom", label: t("nav.prom"), icon: Sparkles },
    { to: "/graphs", label: t("nav.graphs"), icon: BarChart3 },
  ];
  const ccdLinks: NavLink[] = [
    { to: "/pozor/chart", label: t("pozor.tab.chart"), icon: Moon },
    { to: "/pozor/journal", label: t("pozor.tab.journal"), icon: ListChecks },
    { to: "/pozor/minima", label: t("pozor.tab.minima"), icon: Clock, locked: !isPlusActive },
    { to: "/pozor/instant", label: t("pozor.tab.instant"), icon: Star },
    { to: "/pozor/catalog", label: t("pozor.tab.catalog"), icon: BookOpen },
    { to: "/tools", label: t("nav.tools"), icon: Wrench },
  ];
  const alwaysLinks: NavLink[] = [
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon },
    { to: "/about", label: t("nav.info"), icon: Info },
  ];
  const navLinks = [...(mode === "ccd" ? ccdLinks : visualLinks), ...alwaysLinks];

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto px-4 py-1.5 flex items-center justify-between gap-4">
        <a
          href="https://j44soft.webnode.sk"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold tracking-wide text-primary inline-flex items-center gap-2"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 bg-primary shrink-0"
            style={{
              WebkitMaskImage: `url(${logoUrl})`,
              maskImage: `url(${logoUrl})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
            }}
          />
          <span className="flex flex-col leading-tight">
            <span className="inline-flex items-center gap-2 text-lg">
              Visual Astro
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                beta
              </span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
              By JapySoft
            </span>
          </span>
        </a>
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map((l) => link(l.to, l.label, l.icon, l.locked))}
        </nav>
        <ModeToggle
          mode={mode}
          setMode={setMode}
          labelVisual={t("nav.modeVisual")}
          labelCcd={t("nav.modeCcd")}
          className="hidden sm:inline-flex"
        />
        <div className="flex items-center gap-2">
          {user && <div className="hidden md:block"><GlobalSearch /></div>}
          <span className="hidden md:inline text-xs text-muted-foreground">{user?.email}</span>
          <Select value={lang} onValueChange={(v) => setLang(v as any)}>
            <SelectTrigger
              className="h-8 w-[64px] text-[11px] font-semibold uppercase tracking-wider px-2"
              aria-label={t("lang.label")}
              title={t("lang.label")}
            >
              <SelectValue>{lang.toUpperCase()}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {SUPPORTED_LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-sm">
                  <span className="font-semibold uppercase tracking-wider mr-2">{l.code}</span>
                  <span className="text-muted-foreground">{l.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("nav.themeToggle")} title={t("nav.themeToggle")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="hidden sm:inline-flex">
            <LogOut className="h-4 w-4" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label={t("nav.menu")} title={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-1 mt-6">
                <ModeToggle
                  mode={mode}
                  setMode={setMode}
                  labelVisual={t("nav.modeVisual")}
                  labelCcd={t("nav.modeCcd")}
                  className="self-start mb-2"
                />
                {navLinks.map((l) => link(l.to, l.label, l.icon, l.locked))}
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground text-left mt-4"
                >
                  <LogOut className="h-4 w-4" /> {t("nav.logout")}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
