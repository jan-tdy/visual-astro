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
import { Settings as SettingsIcon, Sun, Moon, LogOut } from "lucide-react";

function initialsFor(displayName: string, email: string | undefined) {
  const name = displayName.trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
    if (initials) return initials;
  }
  return (email ?? "").slice(0, 2).toUpperCase() || "?";
}

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { displayName } = useProfile();
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("nav.profile")}
          title={displayName || user?.email || ""}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-semibold">
              {initialsFor(displayName, user?.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
