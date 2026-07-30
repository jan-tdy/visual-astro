import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useI18n, SUPPORTED_LANGS } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, BookOpen, Settings as SettingsIcon, ListChecks, Info, Sun, Moon, Menu, Sparkles, BarChart3, Wrench, Telescope } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import logoUrl from "@/assets/visual-astro-logo.png";

export function AppHeader() {
  const { signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const link = (to: string, label: string, Icon: any) => {
    const active = loc.pathname === to || (to === "/" && loc.pathname.startsWith("/session"));
    return (
      <Link
        to={to}
        onClick={() => setOpen(false)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" /> {label}
      </Link>
    );
  };
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
          {link("/", t("nav.sessions"), ListChecks)}
          {link("/catalog", t("nav.catalog"), BookOpen)}
          {link("/prom", t("nav.prom"), Sparkles)}
          {link("/pozor", t("nav.pozor"), Telescope)}
          {link("/pozor", t("nav.pozor"), Telescope)}
                {link("/graphs", t("nav.graphs"), BarChart3)}
          {link("/tools", t("nav.tools"), Wrench)}
          {link("/settings", t("nav.settings"), SettingsIcon)}
          {link("/about", t("nav.info"), Info)}
        </nav>
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
                {link("/", t("nav.sessions"), ListChecks)}
                {link("/catalog", t("nav.catalog"), BookOpen)}
                {link("/prom", t("nav.prom"), Sparkles)}
                {link("/graphs", t("nav.graphs"), BarChart3)}
                {link("/tools", t("nav.tools"), Wrench)}
                {link("/settings", t("nav.settings"), SettingsIcon)}
                {link("/about", t("nav.info"), Info)}
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