import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  BookOpen, ListChecks, Sparkles, BarChart3, Wrench, Telescope, GitCompare,
} from "lucide-react";
import logoUrl from "@/assets/visual-astro-logo.png";

const PRIMARY_NAV = [
  { to: "/", key: "nav.sessions", icon: ListChecks },
  { to: "/catalog", key: "nav.catalog", icon: BookOpen },
  { to: "/prom", key: "nav.prom", icon: Sparkles },
  { to: "/graphs", key: "nav.graphs", icon: BarChart3 },
] as const;

const SECONDARY_NAV = [
  { to: "/pozor", key: "nav.pozor", icon: Telescope },
  { to: "/compare", key: "nav.compare", icon: GitCompare },
  { to: "/tools", key: "nav.tools", icon: Wrench },
] as const;

export function AppSidebar() {
  const { t } = useI18n();
  const loc = useLocation();
  const isActive = (to: string) => loc.pathname === to || (to === "/" && loc.pathname.startsWith("/session"));

  const renderItems = (items: typeof PRIMARY_NAV | typeof SECONDARY_NAV) => (
    <SidebarMenu>
      {items.map(({ to, key, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton asChild isActive={isActive(to)}>
            <Link to={to}>
              <Icon className="h-4 w-4" />
              <span>{t(key)}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <a
          href="https://j44soft.webnode.sk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-2 py-1.5"
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
          <span className="flex flex-col leading-tight min-w-0">
            <span className="inline-flex items-center gap-2 text-base font-semibold tracking-wide text-primary">
              Visual Astro
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                beta
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground tracking-wide">
              By JapySoft
              <Link
                to="/changelog"
                onClick={(e) => e.stopPropagation()}
                title="Changelog"
                className="underline-offset-2 hover:underline hover:text-primary"
              >
                {__APP_VERSION__}
              </Link>
            </span>
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>{renderItems(PRIMARY_NAV)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>{renderItems(SECONDARY_NAV)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
