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

type ObsRow = { star_id: string; ut_time: string | null };
type StarRow = { id: string; name: string };

const TOP_N = 5;

interface PozorHomeProps {
  onJumpTo: (tab: string) => void;
}

/**
 * "Smart" overview tab for Pozor: tonight's moon phase plus the observer's own
 * most-observed stars (same aggregate the Graphs page computes), so there's an
 * at-a-glance reason to open one of the planning tabs below.
 */
export function PozorHome({ onJumpTo }: PozorHomeProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [obs, setObs] = useState<ObsRow[]>([]);
  const [stars, setStars] = useState<StarRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [obsRes, starsRes] = await Promise.all([
        fetchAllRows<ObsRow>((from, to) =>
          supabase.from("observations").select("star_id,ut_time").order("id").range(from, to),
        ),
        fetchAllRows<StarRow>((from, to) =>
          supabase.from("stars").select("id,name").order("id").range(from, to),
        ),
      ]);
      setObs(obsRes.data);
      setStars(starsRes.data);
      setLoading(false);
    })();
  }, [user?.id]);

  const starById = useMemo(() => Object.fromEntries(stars.map((s) => [s.id, s])), [stars]);

  const topStars = useMemo(() => {
    const m = new Map<string, number>();
    obs.forEach((o) => {
      if (o.ut_time) m.set(o.star_id, (m.get(o.star_id) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([id, count]) => ({ id, name: starById[id]?.name ?? "?", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N);
  }, [obs, starById]);

  const moon = useMemo(() => moonPhaseAt(new Date()), []);
  const moonLabel = moon.waxing ? t("home.tonight.waxing") : t("home.tonight.waning");

  const quickLinks: { tab: string; label: string; icon: typeof Moon }[] = [
    { tab: "chart", label: t("pozor.tab.chart"), icon: Activity },
    { tab: "journal", label: t("pozor.tab.journal"), icon: BookOpen },
    { tab: "minima", label: t("pozor.tab.minima"), icon: CalendarDays },
    { tab: "instant", label: t("pozor.tab.instant"), icon: Info },
    { tab: "moon", label: t("pozor.tab.moon"), icon: Moon },
    { tab: "catalog", label: t("pozor.catalog"), icon: List },
  ];

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
          <h3 className="text-sm font-medium mb-3">{t("graphs.stars.top")}</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("graphs.loading")}</p>
          ) : topStars.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pozor.home.empty")}</p>
          ) : (
            <div className="w-full" style={{ height: Math.max(120, topStars.length * 32) }}>
              <ResponsiveContainer>
                <BarChart data={topStars} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">{t("pozor.home.quickLinks")}</h3>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(({ tab, label, icon: Icon }) => (
            <Button key={tab} variant="outline" size="sm" onClick={() => onJumpTo(tab)}>
              <Icon className="h-4 w-4 mr-1.5" /> {label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
