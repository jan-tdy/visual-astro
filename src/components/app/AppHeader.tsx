import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, Settings as SettingsIcon, ListChecks, Info, Sun, Moon, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function AppHeader() {
  const { signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
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
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="text-lg font-semibold tracking-wide text-primary">✦ Reducciones</Link>
        <nav className="hidden sm:flex items-center gap-1">
          {link("/", "Sessions", ListChecks)}
          {link("/catalog", "Katalóg", BookOpen)}
          {link("/settings", "Nastavenia", SettingsIcon)}
          {link("/about", "Info", Info)}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline text-xs text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Prepnúť režim">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="hidden sm:inline-flex">
            <LogOut className="h-4 w-4" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-1 mt-6">
                {link("/", "Sessions", ListChecks)}
                {link("/catalog", "Katalóg", BookOpen)}
                {link("/settings", "Nastavenia", SettingsIcon)}
                {link("/about", "Info", Info)}
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground text-left mt-4"
                >
                  <LogOut className="h-4 w-4" /> Odhlásiť
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}