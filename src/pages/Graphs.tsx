import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { applyUtTimeToDate, computeMagnitude, dateToJD, parseLimitMagnitude } from "@/lib/astro";
import { useI18n } from "@/hooks/useI18n";
import {
  ResponsiveContainer, ComposedChart, Line, BarChart, Bar, Scatter,
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
  ut_time: string | null;
};

type StarRow = { id: string; name: string; constellation: string };
type SessionRow = { id: string; observed_at_utc: string };

// Open downward triangle — the standard AAVSO symbol for a "fainter-than" (upper-limit) estimate:
// the star was not seen even at this comparison magnitude, so the true magnitude lies below the apex.
function LimitMarker(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  const r = 4.5;
  const points = `${cx - r},${cy - r} ${cx + r},${cy - r} ${cx},${cy + r}`;
  return <polygon points={points} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />;
}

export default function Graphs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [obs, setObs] = useState<ObsRow[]>([]);
  const [stars, setStars] = useState<StarRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStar, setSelectedStar] = useState<string>("");
  const [starPickerOpen, setStarPickerOpen] = useState(false);
  const curveRef = useRef<HTMLDivElement>(null);
  const perMonthRef = useRef<HTMLDivElement>(null);
  const sessionsPerMonthRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const constRef = useRef<HTMLDivElement>(null);

  const exportChartPNG = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    const container = ref.current;
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) { toast({ title: "Nothing to export" }); return; }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Inline computed colors from CSS variables so exported PNG is readable
    const rect = svg.getBoundingClientRect();
    const w = Math.ceil(rect.width) || 800;
    const h = Math.ceil(rect.height) || 400;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // Resolve CSS vars in stroke/fill attributes and inline styles
    const cs = getComputedStyle(document.documentElement);
    const resolve = (v: string) =>
      v.replace(/hsl\(var\(([^)]+)\)\)/g, (_, name) => `hsl(${cs.getPropertyValue(name.trim()).trim()})`);
    clone.querySelectorAll<SVGElement>("*").forEach((el) => {
      ["fill", "stroke"].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (val && val.includes("var(")) el.setAttribute(attr, resolve(val));
      });
      const style = el.getAttribute("style");
      if (style && style.includes("var(")) el.setAttribute("style", resolve(style));
    });
    const bg = `hsl(${cs.getPropertyValue("--background").trim()})`;
    const fg = `hsl(${cs.getPropertyValue("--foreground").trim()})`;
    clone.querySelectorAll<SVGElement>("text").forEach((el) => {
      if (!el.getAttribute("fill")) el.setAttribute("fill", fg);
    });
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([`<?xml version="1.0"?>${xml}`], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  const exportCurveCSV = () => {
    if (lightCurve.length === 0 && limitCurve.length === 0) return;
    const starName = starById[selectedStar]?.name ?? "star";
    const combined = [
      ...lightCurve.map((p) => ({ ...p, type: "detection" as const })),
      ...limitCurve.map((p) => ({ ...p, type: "limit" as const })),
    ].sort((a, b) => a.jd - b.jd);
    const rows = [["JD", "date", "mag", "type"], ...combined.map((p) => [p.jd, p.date, p.mag, p.type])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${starName.replace(/\s+/g, "_")}_lightcurve.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Paginated fetch — PostgREST caps single requests at ~1000 rows.
      const fetchAll = async <T,>(table: string, cols: string): Promise<T[]> => {
        const pageSize = 1000;
        const all: T[] = [];
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from(table as any)
            .select(cols)
            .range(from, from + pageSize - 1);
          if (error || !data) break;
          all.push(...(data as T[]));
          if (data.length < pageSize) break;
        }
        return all;
      };
      const [o, s, se] = await Promise.all([
        fetchAll<ObsRow>("observations", "id,session_id,star_id,a,b,pasos_a,pasos_b,limit_value,note,ut_time"),
        fetchAll<StarRow>("stars", "id,name,constellation"),
        fetchAll<SessionRow>("sessions", "id,observed_at_utc"),
      ]);
      setObs(o);
      setStars([...s].sort((x, y) => x.name.localeCompare(y.name)));
      setSessions(se);
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
        if (isNaN(d.getTime())) return;
        // Overlay UT time on the session date when available (session dt is often 18:00 placeholder).
        applyUtTimeToDate(d, o.ut_time);
        if (!Number.isFinite(numeric)) return;
        points.push({
          jd: +dateToJD(d).toFixed(5),
          date: d.toISOString().slice(0, 16).replace("T", " "),
          mag: +numeric.toFixed(3),
        });
      });
    return points.sort((a, b) => a.jd - b.jd);
  }, [realObs, selectedStar, starById, sessionById]);

  // "Fainter than" (upper-limit) observations for the selected star — the star wasn't
  // seen even at this comparison magnitude, so plotted separately from real detections.
  const limitCurve = useMemo(() => {
    if (!selectedStar) return [];
    const points: { jd: number; date: string; mag: number }[] = [];
    realObs
      .filter(o => o.star_id === selectedStar && o.limit_value && o.limit_value.trim())
      .forEach(o => {
        const dt = sessionById[o.session_id]?.observed_at_utc;
        if (!dt) return;
        const mag = parseLimitMagnitude(o.limit_value);
        if (mag == null) return;
        const d = new Date(dt);
        if (isNaN(d.getTime())) return;
        applyUtTimeToDate(d, o.ut_time);
        points.push({
          jd: +dateToJD(d).toFixed(5),
          date: d.toISOString().slice(0, 16).replace("T", " "),
          mag: +mag.toFixed(3),
        });
      });
    return points.sort((a, b) => a.jd - b.jd);
  }, [realObs, selectedStar, sessionById]);

  // Basic descriptive statistics for the selected star's detections.
  const curveStats = useMemo(() => {
    if (lightCurve.length === 0) return null;
    const mags = lightCurve.map(p => p.mag);
    const n = mags.length;
    const mean = mags.reduce((s, v) => s + v, 0) / n;
    const variance = n > 1 ? mags.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const stdDev = Math.sqrt(variance);
    const brightest = Math.min(...mags);
    const faintest = Math.max(...mags);
    const span = lightCurve[lightCurve.length - 1].jd - lightCurve[0].jd;
    return { n, mean, stdDev, amplitude: faintest - brightest, span, limits: limitCurve.length };
  }, [lightCurve, limitCurve]);

  // Chart domains must account for limit markers too, or they'd be clipped off-axis.
  const curveXDomain = useMemo((): [number | string, number | string] => {
    const jds = [...lightCurve.map(p => p.jd), ...limitCurve.map(p => p.jd)];
    if (jds.length === 0) return ["dataMin", "dataMax"];
    return [Math.min(...jds), Math.max(...jds)];
  }, [lightCurve, limitCurve]);

  const curveYDomain = useMemo((): [number, number] => {
    const mags = [...lightCurve.map(p => p.mag), ...limitCurve.map(p => p.mag)];
    if (mags.length === 0) return [0, 1];
    return [+(Math.min(...mags) - 0.2).toFixed(2), +(Math.max(...mags) + 0.2).toFixed(2)];
  }, [lightCurve, limitCurve]);

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
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <Button variant="outline" size="sm" onClick={() => exportChartPNG(curveRef, `${starById[selectedStar]?.name ?? "star"}_lightcurve.png`)} disabled={lightCurve.length === 0 && limitCurve.length === 0}>
                      <Download className="h-4 w-4 mr-1" /> PNG
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCurveCSV} disabled={lightCurve.length === 0 && limitCurve.length === 0}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                    </div>
                  </div>
                  {curveStats && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mb-3">
                      <span>{t("graphs.curve.stat.n")}: <b className="text-foreground">{curveStats.n}</b></span>
                      <span>{t("graphs.curve.stat.mean")}: <b className="text-foreground">{curveStats.mean.toFixed(2)}</b></span>
                      <span>{t("graphs.curve.stat.stddev")}: <b className="text-foreground">±{curveStats.stdDev.toFixed(2)}</b></span>
                      <span>{t("graphs.curve.stat.amplitude")}: <b className="text-foreground">{curveStats.amplitude.toFixed(2)}</b></span>
                      <span>{t("graphs.curve.stat.span")}: <b className="text-foreground">{curveStats.span.toFixed(1)} d</b></span>
                      {curveStats.limits > 0 && (
                        <span>{t("graphs.curve.stat.limits")}: <b className="text-foreground">{curveStats.limits}</b></span>
                      )}
                    </div>
                  )}
                  {lightCurve.length === 0 && limitCurve.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-6 text-center">
                      {t("graphs.curve.empty")}
                    </p>
                  ) : (
                    <>
                    <div ref={curveRef} className="w-full h-80">
                      <ResponsiveContainer>
                        <ComposedChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="jd"
                            type="number"
                            domain={curveXDomain}
                            tickFormatter={(v: number) => v.toFixed(2)}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            label={{ value: "JD", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          />
                          <YAxis
                            reversed
                            domain={curveYDomain}
                            tickFormatter={(v: number) => v.toFixed(2)}
                            allowDecimals
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            label={{ value: "mag", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                            formatter={(v: number, name: string) => [v.toFixed(2), name]}
                            labelFormatter={(jd: number) => {
                              const p = lightCurve.find(x => x.jd === jd) ?? limitCurve.find(x => x.jd === jd);
                              return p ? `JD ${jd} · ${p.date}` : `JD ${jd}`;
                            }}
                          />
                          <Line data={lightCurve} type="linear" dataKey="mag" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={{ r: 2.5 }} isAnimationActive={false} connectNulls={false} name={t("graphs.curve.legend.detection")} />
                          {limitCurve.length > 0 && (
                            <Scatter data={limitCurve} dataKey="mag" shape={LimitMarker} isAnimationActive={false} name={t("graphs.curve.legend.limit")} />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {limitCurve.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(var(--primary))" }} />
                          {t("graphs.curve.legend.detection")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden className="inline-block" style={{
                            width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
                            borderTop: "8px solid hsl(var(--muted-foreground))",
                          }} />
                          {t("graphs.curve.legend.limit")}
                        </span>
                      </p>
                    )}
                    </>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="time">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t("graphs.time.obsPerMonth")}</h3>
                    <Button variant="outline" size="sm" onClick={() => exportChartPNG(perMonthRef, "obs_per_month.png")}>
                      <Download className="h-4 w-4 mr-1" /> PNG
                    </Button>
                  </div>
                  <div ref={perMonthRef} className="w-full h-72">
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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t("graphs.time.sessionsPerMonth")}</h3>
                    <Button variant="outline" size="sm" onClick={() => exportChartPNG(sessionsPerMonthRef, "sessions_per_month.png")}>
                      <Download className="h-4 w-4 mr-1" /> PNG
                    </Button>
                  </div>
                  <div ref={sessionsPerMonthRef} className="w-full h-72">
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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t("graphs.stars.top")}</h3>
                    <Button variant="outline" size="sm" onClick={() => exportChartPNG(starsRef, "stars_top.png")}>
                      <Download className="h-4 w-4 mr-1" /> PNG
                    </Button>
                  </div>
                  <div ref={starsRef} className="w-full" style={{ height: Math.max(240, perStar.length * 22) }}>
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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t("graphs.const.title")}</h3>
                    <Button variant="outline" size="sm" onClick={() => exportChartPNG(constRef, "constellations.png")}>
                      <Download className="h-4 w-4 mr-1" /> PNG
                    </Button>
                  </div>
                  <div ref={constRef} className="w-full" style={{ height: Math.max(240, perConstellation.length * 24) }}>
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