import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeMagnitude, dateToJD } from "@/lib/astro";
import { useI18n } from "@/hooks/useI18n";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type ObsRow = {
  id: string;
  session_id: string;
  star_id: string;
  a: string | null;
  b: string | null;
  pasos_a: number | null;
  pasos_b: number | null;
  limit_value: string | null;
  note: string | null;
};

type StarRow = { id: string; name: string; constellation: string };
type SessionRow = { id: string; observed_at_utc: string };

export default function Graphs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [obs, setObs] = useState<ObsRow[]>([]);
  const [stars, setStars] = useState<StarRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStar, setSelectedStar] = useState<string>("");
  const [starPickerOpen, setStarPickerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: s }, { data: se }] = await Promise.all([
        supabase.from("observations").select("id,session_id,star_id,a,b,pasos_a,pasos_b,limit_value,note"),
        supabase.from("stars").select("id,name,constellation").order("name"),
        supabase.from("sessions").select("id,observed_at_utc"),
      ]);
      setObs((o ?? []) as ObsRow[]);
      setStars((s ?? []) as StarRow[]);
      setSessions((se ?? []) as SessionRow[]);
      setLoading(false);
    })();
  }, [user?.id]);

  const starById = useMemo(() => Object.fromEntries(stars.map(s => [s.id, s])), [stars]);
  const sessionById = useMemo(() => Object.fromEntries(sessions.map(s => [s.id, s])), [sessions]);

  // Only "real" observations (have any data)
  const realObs = useMemo(
    () => obs.filter(o => (o.a || o.b || o.limit_value || o.note || o.pasos_a != null || o.pasos_b != null)),
    [obs]
  );

  // Per-star counts
  const perStar = useMemo(() => {
    const m = new Map<string, number>();
    realObs.forEach(o => m.set(o.star_id, (m.get(o.star_id) ?? 0) + 1));
    return Array.from(m.entries())
      .map(([id, count]) => ({
        id,
        name: starById[id]?.name ?? "?",
        constellation: starById[id]?.constellation ?? "",
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [realObs, starById]);

  // Observations per month
  const perMonth = useMemo(() => {
    const m = new Map<string, number>();
    realObs.forEach(o => {
      const dt = sessionById[o.session_id]?.observed_at_utc;
      if (!dt) return;
      const d = new Date(dt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [realObs, sessionById]);

  // Sessions per month (distinct session ids)
  const sessionsPerMonth = useMemo(() => {
    const m = new Map<string, Set<string>>();
    realObs.forEach(o => {
      const dt = sessionById[o.session_id]?.observed_at_utc;
      if (!dt) return;
      const d = new Date(dt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(o.session_id);
    });
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, set]) => ({ month, count: set.size }));
  }, [realObs, sessionById]);

  // Per-constellation
  const perConstellation = useMemo(() => {
    const m = new Map<string, number>();
    realObs.forEach(o => {
      const c = starById[o.star_id]?.constellation ?? "?";
      m.set(c, (m.get(c) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([constellation, count]) => ({ constellation, count }))
      .sort((a, b) => b.count - a.count);
  }, [realObs, starById]);

  // Default selected star = first one observed
  useEffect(() => {
    if (!selectedStar && perStar.length > 0) setSelectedStar(perStar[0].id);
  }, [perStar, selectedStar]);

  // Light curve for selected star
  const lightCurve = useMemo(() => {
    if (!selectedStar) return [];
    const starName = starById[selectedStar]?.name;
    const points: { jd: number; date: string; mag: number }[] = [];
    realObs
      .filter(o => o.star_id === selectedStar)
      .forEach(o => {
        const dt = sessionById[o.session_id]?.observed_at_utc;
        if (!dt) return;
        const { numeric } = computeMagnitude(o, starName);
        if (numeric == null) return;
        const d = new Date(dt);
        points.push({
          jd: +dateToJD(d).toFixed(4),
          date: d.toISOString().slice(0, 10),
          mag: +numeric.toFixed(2),
        });
      });
    return points.sort((a, b) => a.jd - b.jd);
  }, [realObs, selectedStar, starById, sessionById]);

  const totalObs = realObs.length;
  const totalStars = perStar.length;
  const totalSessions = sessions.length;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl font-semibold mb-1">{t("graphs.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("graphs.subtitle")}</p>

        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">{t("graphs.loading")}</Card>
        ) : totalObs === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">{t("graphs.empty")}</Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("graphs.stat.obs")}</div>
                <div className="text-2xl font-semibold">{totalObs}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("graphs.stat.stars")}</div>
                <div className="text-2xl font-semibold">{totalStars}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("graphs.stat.sessions")}</div>
                <div className="text-2xl font-semibold">{totalSessions}</div>
              </Card>
            </div>

            <Tabs defaultValue="curve" className="w-full">
              <TabsList className="mb-4 flex-wrap h-auto">
                <TabsTrigger value="curve">{t("graphs.tab.curve")}</TabsTrigger>
                <TabsTrigger value="time">{t("graphs.tab.time")}</TabsTrigger>
                <TabsTrigger value="stars">{t("graphs.tab.stars")}</TabsTrigger>
                <TabsTrigger value="const">{t("graphs.tab.const")}</TabsTrigger>
              </TabsList>

              <TabsContent value="curve">
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h3 className="font-semibold">{t("graphs.curve.title")}</h3>
                    <Popover open={starPickerOpen} onOpenChange={setStarPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-64 justify-between">
                          {(() => {
                            const s = perStar.find(x => x.id === selectedStar);
                            return s ? `${s.name} ${s.constellation} · ${s.count}×` : t("graphs.curve.pick");
                          })()}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="end">
                        <Command>
                          <CommandInput placeholder={t("graphs.curve.search")} />
                          <CommandList>
                            <CommandEmpty>{t("graphs.curve.none")}</CommandEmpty>
                            <CommandGroup>
                              {perStar.map(s => (
                                <CommandItem
                                  key={s.id}
                                  value={`${s.name} ${s.constellation}`}
                                  onSelect={() => { setSelectedStar(s.id); setStarPickerOpen(false); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", selectedStar === s.id ? "opacity-100" : "opacity-0")} />
                                  {s.name} {s.constellation} · {s.count}×
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {lightCurve.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-6 text-center">
                      {t("graphs.curve.empty")}
                    </p>
                  ) : (
                    <div className="w-full h-80">
                      <ResponsiveContainer>
                        <LineChart data={lightCurve} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="jd"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            label={{ value: "JD", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          />
                          <YAxis
                            reversed
                            domain={["dataMin - 0.2", "dataMax + 0.2"]}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            label={{ value: "mag", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                            formatter={(v: number) => v.toFixed(2)}
                            labelFormatter={(jd: number) => {
                              const p = lightCurve.find(x => x.jd === jd);
                              return p ? `JD ${jd} · ${p.date}` : `JD ${jd}`;
                            }}
                          />
                          <Line type="monotone" dataKey="mag" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="time">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">{t("graphs.time.obsPerMonth")}</h3>
                  <div className="w-full h-72">
                    <ResponsiveContainer>
                      <BarChart data={perMonth} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4 mt-4">
                  <h3 className="font-semibold mb-3">{t("graphs.time.sessionsPerMonth")}</h3>
                  <div className="w-full h-72">
                    <ResponsiveContainer>
                      <BarChart data={sessionsPerMonth} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="stars">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">{t("graphs.stars.top")}</h3>
                  <div className="w-full" style={{ height: Math.max(240, perStar.length * 22) }}>
                    <ResponsiveContainer>
                      <BarChart data={perStar.slice(0, 30)} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="const">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">{t("graphs.const.title")}</h3>
                  <div className="w-full" style={{ height: Math.max(240, perConstellation.length * 24) }}>
                    <ResponsiveContainer>
                      <BarChart data={perConstellation} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis type="category" dataKey="constellation" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}