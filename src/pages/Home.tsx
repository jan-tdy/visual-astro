import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/app/AppShell";
import { DataLossNotice } from "@/components/app/DataLossNotice";
import { WhatsNewBanner } from "@/components/app/WhatsNewBanner";
import { YearContributionGraph } from "@/components/graphs/YearContributionGraph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, ListChecks, Star, Moon, Telescope } from "lucide-react";
import { toast } from "sonner";
import { computeMagnitude, dateToJD } from "@/lib/astro";
import { formatUT, nightInfo } from "@/lib/pozor";
import { resolveLocation, usePozorLocations, usePozorSettings, todayIso } from "@/components/pozor/shared";
import { getPrefs } from "@/hooks/usePrefs";
import { seedCatalogIfNeeded } from "@/lib/seed";
import { useI18n } from "@/hooks/useI18n";

interface SessionRow {
  id: string;
  observed_at_utc: string;
  jd: number | null;
  notes: string | null;
  name: string | null;
  is_favorite: boolean;
  obs_count: number;
}

const RECENT_COUNT = 5;

export default function Home() {
  const { user } = useAuth();
  const { displayName } = useProfile();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const { locations } = usePozorLocations();
  const { settings } = usePozorSettings();

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await seedCatalogIfNeeded(user.id);
      } catch (e: any) {
        console.error(e);
        toast.error(`${t("sessions.seedFailed")}: ${e.message}`);
      }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, observed_at_utc, jd, notes, name, is_favorite, observations(ut_time, star_id, a, pasos_a, pasos_b, b, limit_value)")
      .order("observed_at_utc", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      const { data: starRows } = await supabase.from("stars").select("id, name");
      const starNameById = new Map((starRows ?? []).map((s) => [s.id, s.name]));
      const compLabelThreshold = getPrefs().compLabelThreshold;
      setSessions(
        (data ?? []).map((s: any) => ({
          ...s,
          // Matches the editor's own "filled" definition: a UT time alone isn't enough,
          // the magnitude has to be computable too, or the export/graphs skip the row anyway.
          obs_count: (s.observations ?? []).filter(
            (o: any) =>
              o.ut_time && String(o.ut_time).trim() &&
              computeMagnitude(o, starNameById.get(o.star_id), compLabelThreshold).value !== null,
          ).length,
        })),
      );
    }
    setLoading(false);
  };

  const newSession = async () => {
    if (!user) return;
    const now = new Date();
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, observed_at_utc: now.toISOString(), jd: dateToJD(now) })
      .select()
      .single();
    if (error) return toast.error(error.message);
    nav(`/session/${created.id}`);
  };

  // One cell per calendar day, counting that day's computable-magnitude observations —
  // same convention the Graphs page's year heatmap uses.
  const dailyCounts = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach((s) => {
      const d = new Date(s.observed_at_utc);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);
      m.set(key, (m.get(key) ?? 0) + s.obs_count);
    });
    return m;
  }, [sessions]);

  const [activityYear, setActivityYear] = useState(() => new Date().getUTCFullYear());
  const yearInitedRef = useRef(false);
  useEffect(() => {
    if (yearInitedRef.current || dailyCounts.size === 0) return;
    const years = Array.from(dailyCounts.keys()).map((k) => Number(k.slice(0, 4)));
    setActivityYear(Math.max(...years));
    yearInitedRef.current = true;
  }, [dailyCounts]);

  const totalObservations = useMemo(() => sessions.reduce((sum, s) => sum + s.obs_count, 0), [sessions]);
  const sessionsThisMonth = useMemo(() => {
    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    return sessions.filter((s) => s.observed_at_utc.slice(0, 7) === ym).length;
  }, [sessions]);

  const tonightLocation = useMemo(() => resolveLocation(locations, settings.locationId), [locations, settings.locationId]);
  const tonight = useMemo(() => nightInfo(todayIso(), tonightLocation), [tonightLocation]);
  const darkness = useMemo(() => {
    if (!tonight.start || !tonight.end) return null;
    const totalMin = Math.round((tonight.end.getTime() - tonight.start.getTime()) / 60000);
    return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
  }, [tonight]);

  const recent = sessions.slice(0, RECENT_COUNT);
  const locale = lang === "sk" ? "sk-SK" : "en-GB";

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <WhatsNewBanner />
        <DataLossNotice />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{t("home.greeting")}{displayName ? `, ${displayName}` : ""}</h1>
            <p className="text-sm text-muted-foreground">{t("home.subtitle")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={newSession}>
              <Plus className="h-4 w-4 mr-1.5" /> {t("home.newSession")}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/sessions">
                <ListChecks className="h-4 w-4 mr-1.5" /> {t("home.viewSessions")}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 space-y-3 md:col-span-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Moon className="h-4 w-4 text-primary" /> {t("home.tonight.title")}
            </div>
            <div>
              {darkness ? (
                <>
                  <div className="text-3xl font-semibold tabular-nums">{darkness.h}h {darkness.m}m</div>
                  <div className="text-xs text-muted-foreground">
                    {formatUT(tonight.start)}–{formatUT(tonight.end)} UT · {tonightLocation.label}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">{t("home.tonight.noDarkness")}</div>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild className="px-0 h-auto text-primary hover:text-primary">
              <Link to="/pozor">
                <Telescope className="h-3.5 w-3.5 mr-1.5" /> {t("home.tonight.cta")}
              </Link>
            </Button>
          </Card>

          <Card className="p-5 space-y-3 md:col-span-2">
            <div className="text-sm font-medium">{t("home.stats.title")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{sessions.length}</div>
                <div className="text-xs text-muted-foreground">{t("settings.usage.sessions")}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{totalObservations}</div>
                <div className="text-xs text-muted-foreground">{t("settings.usage.obs")}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{sessionsThisMonth}</div>
                <div className="text-xs text-muted-foreground">{t("home.stats.thisMonth")}</div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3">{t("home.activity.title")}</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <YearContributionGraph counts={dailyCounts} year={activityYear} onYearChange={setActivityYear} />
          )}
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">{t("home.recent.title")}</h2>
            <Link to="/sessions" className="text-xs text-primary hover:underline">
              {t("home.recent.viewAll")}
            </Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">{t("sessions.none")}</Card>
          ) : (
            <div className="space-y-2">
              {recent.map((s) => (
                <Link key={s.id} to={`/session/${s.id}`}>
                  <Card className="p-5 hover:border-primary/40 transition-colors">
                    <div className="font-medium">
                      {s.is_favorite && <Star className="inline h-3.5 w-3.5 mr-1 text-primary fill-current" />}
                      {s.name ? (
                        <>
                          {s.name}
                          <span className="text-muted-foreground font-normal"> · {new Date(s.observed_at_utc).toLocaleDateString(locale, { dateStyle: "medium" })}</span>
                        </>
                      ) : (
                        new Date(s.observed_at_utc).toLocaleDateString(locale, { dateStyle: "medium" })
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      JD {s.jd?.toFixed(4) ?? "—"} · {s.obs_count} {t("sessions.observations")}
                      {s.notes ? ` · ${s.notes}` : ""}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
