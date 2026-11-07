import { useMemo } from "react";
import { Moon, Activity, BookOpen, CalendarDays, Info, List } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { moonPhaseAt } from "@/lib/pozor";
import { mostUsedTargets, readTargetUsage } from "@/lib/pozorTargetUsage";
import { AltitudeChart } from "./AltitudeChart";
import { resolveLocation, todayIso, type CcdTarget, type PozorLocationRow, type PozorSettings } from "./shared";

interface PozorHomeProps {
  onJumpTo: (tab: string) => void;
  targets: CcdTarget[];
  loading: boolean;
  settings: PozorSettings;
  locations: PozorLocationRow[];
}

const TAB_DEFS: { tab: string; labelKey: string; icon: typeof Moon }[] = [
  { tab: "chart", labelKey: "pozor.tab.chart", icon: Activity },
  { tab: "journal", labelKey: "pozor.tab.journal", icon: BookOpen },
  { tab: "minima", labelKey: "pozor.tab.minima", icon: CalendarDays },
  { tab: "instant", labelKey: "pozor.tab.instant", icon: Info },
  { tab: "moon", labelKey: "pozor.tab.moon", icon: Moon },
  { tab: "catalog", labelKey: "pozor.catalog", icon: List },
];

/** Tonight's altitude curves for targets explicitly selected in POZOR planning. */
export function PozorHome({ onJumpTo, targets, loading, settings, locations }: PozorHomeProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const topTargets = useMemo(() => mostUsedTargets(targets, user ? readTargetUsage(user.id) : {}), [targets, user?.id]);
  const location = resolveLocation(locations, settings.locationId);
  const date = todayIso();

  const moon = useMemo(() => moonPhaseAt(new Date()), []);
  const moonLabel = moon.waxing ? t("home.tonight.waxing") : t("home.tonight.waning");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 border-b border-border pb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Moon className="h-4 w-4 text-primary" /> {t("home.tonight.title")}
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums">{Math.round(moon.pct)}%</div>
            <div className="text-xs text-muted-foreground">{moonLabel}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{date} · {location.label}</div>
      </div>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">{t("pozor.home.topStars")}</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("graphs.loading")}</p>
          ) : topTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pozor.home.noStars")}</p>
          ) : (
            <AltitudeChart date={date} location={location} targets={topTargets} minAltitude={settings.minAltitude} range={settings.range} />
          )}
        </section>

      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">{t("pozor.home.quickLinks")}</h3>
        <div className="flex flex-wrap gap-2">
          {TAB_DEFS.map(({ tab, labelKey, icon: Icon }) => (
            <Button key={tab} variant="outline" size="sm" onClick={() => onJumpTo(tab)}>
              <Icon className="h-4 w-4 mr-1.5" /> {t(labelKey)}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
