import {
  Home, BookOpen, ListChecks, Sparkles, BarChart3, Wrench, Telescope, GitCompare, Satellite, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  key: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/sessions", key: "nav.sessions", icon: ListChecks },
  { to: "/catalog", key: "nav.catalog", icon: BookOpen },
  { to: "/prom", key: "nav.prom", icon: Sparkles },
  { to: "/graphs", key: "nav.graphs", icon: BarChart3 },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: "/pozor", key: "nav.pozor", icon: Telescope },
  { to: "/japyscope", key: "nav.japyscope", icon: Satellite },
  { to: "/compare", key: "nav.compare", icon: GitCompare },
  { to: "/tools", key: "nav.tools", icon: Wrench },
];

export function isNavActive(pathname: string, to: string) {
  if (to === "/sessions") return pathname === "/sessions" || pathname.startsWith("/session/");
  return pathname === to;
}
