import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, Settings as SettingsIcon, ListChecks, Info, Sun, Moon } from "lucide-react";

export function AppHeader() {
  const { signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
  const loc = useLocation();
  const link = (to: string, label: string, Icon: any) => {
    const active = loc.pathname === to || (to === "/" && loc.pathname.startsWith("/session"));
    return (
      <Link
        to={to}
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
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}