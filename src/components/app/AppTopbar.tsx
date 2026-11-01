import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, SUPPORTED_LANGS, type Lang } from "@/hooks/useI18n";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive } from "@/components/app/navItems";
import logoUrl from "@/assets/visual-astro-logo.png";

interface AppTopbarProps {
  navStyle: "sidebar" | "topbar";
  onToggleNavStyle: () => void;
}

export function AppTopbar({ navStyle, onToggleNavStyle }: AppTopbarProps) {
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const link = (to: string, label: string, Icon: (typeof PRIMARY_NAV)[number]["icon"]) => (
    <Link
      key={to}
      to={to}
      onClick={() => setOpen(false)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${
        isNavActive(loc.pathname, to) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );

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
              <Link
                to="/changelog"
                onClick={(e) => e.stopPropagation()}
                title="Changelog"
                className="text-[10px] font-medium text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
              >
                {__APP_VERSION__}
              </Link>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
              By JapySoft
            </span>
          </span>
        </a>
        <nav className="hidden sm:flex items-center gap-1 min-w-0 flex-1 overflow-x-auto">
          {PRIMARY_NAV.map(({ to, key, icon }) => link(to, t(key), icon))}
          <div className="h-5 w-px bg-border mx-1 shrink-0" aria-hidden />
          {SECONDARY_NAV.map(({ to, key, icon }) => link(to, t(key), icon))}
        </nav>
        <div className="flex items-center gap-2">
          {user && <div className="hidden md:block"><GlobalSearch /></div>}
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
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
          <ProfileMenu navStyle={navStyle} onToggleNavStyle={onToggleNavStyle} />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label={t("nav.menu")} title={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-1 mt-6">
                {PRIMARY_NAV.map(({ to, key, icon }) => link(to, t(key), icon))}
                <div className="h-px bg-border my-1" aria-hidden />
                {SECONDARY_NAV.map(({ to, key, icon }) => link(to, t(key), icon))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
