import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/hooks/useI18n";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings as SettingsIcon, Sun, Moon, LogOut, PanelLeft, PanelTop } from "lucide-react";

function initialsFor(displayName: string, email: string | undefined) {
  const name = displayName.trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
    if (initials) return initials;
  }
  return (email ?? "").slice(0, 2).toUpperCase() || "?";
}

interface ProfileMenuProps {
  navStyle?: "sidebar" | "topbar";
  onToggleNavStyle?: () => void;
  /** "icon": a bare avatar button (topbar). "full": a wide row with name/email (sidebar footer). */
  variant?: "icon" | "full";
}

export function ProfileMenu({ navStyle, onToggleNavStyle, variant = "icon" }: ProfileMenuProps) {
  const { user, signOut } = useAuth();
  const { displayName } = useProfile();
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  const avatar = (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="text-xs font-semibold">
        {initialsFor(displayName, user?.email)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "full" ? (
          <button
            type="button"
            aria-label={t("nav.profile")}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            {avatar}
            <span className="min-w-0 flex-1 truncate">{displayName || user?.email}</span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={t("nav.profile")}
            title={displayName || user?.email || ""}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {avatar}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "full" ? "start" : "end"}
        side={variant === "full" ? "top" : "bottom"}
        className="w-56"
      >
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {displayName || user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <SettingsIcon className="h-4 w-4 mr-2" /> {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggle}>
          {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          {theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
        </DropdownMenuItem>
        {onToggleNavStyle && (
          <DropdownMenuItem onClick={onToggleNavStyle}>
            {navStyle === "sidebar" ? <PanelTop className="h-4 w-4 mr-2" /> : <PanelLeft className="h-4 w-4 mr-2" />}
            {navStyle === "sidebar" ? t("nav.useTopbar") : t("nav.useSidebar")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
