import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { GlobalSearch } from "@/components/app/GlobalSearch";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { prefs, update } = usePrefs();
  const toggleNavStyle = () => update({ navStyle: prefs.navStyle === "sidebar" ? "topbar" : "sidebar" });

  if (prefs.navStyle === "topbar") {
    return (
      <div className="min-h-screen">
        <AppTopbar navStyle={prefs.navStyle} onToggleNavStyle={toggleNavStyle} />
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar onToggleNavStyle={toggleNavStyle} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/60 backdrop-blur px-4 py-2">
          <SidebarTrigger aria-label={t("nav.menu")} title={t("nav.menu")} />
          {user && <div className="hidden md:block"><GlobalSearch /></div>}
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
