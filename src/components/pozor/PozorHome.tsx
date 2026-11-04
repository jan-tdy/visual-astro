import { useEffect, useMemo, useState } from "react";
import { Moon, Activity, BookOpen, CalendarDays, Info, List } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { moonPhaseAt } from "@/lib/pozor";

type VisitRow = { tab: string };

interface PozorHomeProps {
  onJumpTo: (tab: string) => void;
}

const TAB_DEFS: { tab: string; labelKey: string; icon: typeof Moon }[] = [
  { tab: "chart", labelKey: "pozor.tab.chart", icon: Activity },
  { tab: "journal", labelKey: "pozor.tab.journal", icon: BookOpen },
  { tab: "minima", labelKey: "pozor.tab.minima", icon: CalendarDays },
  { tab: "instant", labelKey: "pozor.tab.instant", icon: Info },
  { tab: "moon", labelKey: "pozor.tab.moon", icon: Moon },
  { tab: "catalog", labelKey: "pozor.catalog", icon: List },
];

/**
 * "Smart" overview tab for Pozor: tonight's moon phase plus the observer's own
 * most-used Pozor tabs, from the pozor_tab_visits activity log (Pozor usage
 * only — deliberately not the Sessions/observations data Graphs computes).
 */
export function PozorHome({ onJumpTo }: PozorHomeProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await fetchAllRows<VisitRow>((from, to) =>
        supabase.from("pozor_tab_visits").select("tab").order("id").range(from, to),
      );
      setVisits(data);
      setLoading(false);
    })();
  }, [user?.id]);

  const topTabs = useMemo(() => {
    const m = new Map<string, number>();
    visits.forEach((v) => m.set(v.tab, (m.get(v.tab) ?? 0) + 1));
    return TAB_DEFS
      .map((d) => ({ tab: d.tab, name: t(d.labelKey), count: m.get(d.tab) ?? 0 }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [visits, t]);

  const moon = useMemo(() => moonPhaseAt(new Date()), []);
  const moonLabel = moon.waxing ? t("home.tonight.waxing") : t("home.tonight.waning");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 space-y-3 md:col-span-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Moon className="h-4 w-4 text-primary" /> {t("home.tonight.title")}
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums">{Math.round(moon.pct)}%</div>
            <div className="text-xs text-muted-foreground">{moonLabel}</div>
          </div>
        </Card>

        <Card className="p-5 md:col-span-2">
          <h3 className="text-sm font-medium mb-3">{t("pozor.home.topTabs")}</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("graphs.loading")}</p>
          ) : topTabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pozor.home.empty")}</p>
          ) : (
            <div className="w-full" style={{ height: Math.max(120, topTabs.length * 32) }}>
              <ResponsiveContainer>
                <BarChart data={topTabs} layout="vertical" margin={{ top: 5, right: 20, left: 70, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                    onClick={(d) => {
                      const tab = d.payload?.tab as string | undefined;
                      if (tab) onJumpTo(tab);
                    }}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

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
