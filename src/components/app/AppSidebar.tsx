import { Link, useLocation } from "react-router-dom";
import { useI18n, SUPPORTED_LANGS, type Lang } from "@/hooks/useI18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive, type NavItem } from "@/components/app/navItems";
import logoUrl from "@/assets/visual-astro-logo.png";

interface AppSidebarProps {
  onToggleNavStyle: () => void;
}

export function AppSidebar({ onToggleNavStyle }: AppSidebarProps) {
  const { t, lang, setLang } = useI18n();
  const loc = useLocation();

  const renderItems = (items: NavItem[]) => (
    <SidebarMenu>
      {items.map(({ to, key, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton asChild isActive={isNavActive(loc.pathname, to)}>
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
      <SidebarFooter>
        <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
          <SelectTrigger
            className="h-8 text-[11px] font-semibold uppercase tracking-wider px-2"
            aria-label={t("lang.label")}
            title={t("lang.label")}
          >
            <SelectValue>{lang.toUpperCase()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code} className="text-sm">
                <span className="font-semibold uppercase tracking-wider mr-2">{l.code}</span>
                <span className="text-muted-foreground">{l.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ProfileMenu variant="full" navStyle="sidebar" onToggleNavStyle={onToggleNavStyle} />
      </SidebarFooter>
    </Sidebar>
  );
}
