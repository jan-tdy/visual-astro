import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, SUPPORTED_LANGS } from "@/hooks/useI18n";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/60 backdrop-blur px-4 py-2">
          <SidebarTrigger aria-label={t("nav.menu")} title={t("nav.menu")} />
          <div className="flex items-center gap-2 shrink-0">
            {user && <div className="hidden md:block"><GlobalSearch /></div>}
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
            <ProfileMenu />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
