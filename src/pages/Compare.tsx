import { useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Scatter,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/useI18n";
import { fetchAavsoObservations, AAVSO_BANDS, type AavsoObservation } from "@/lib/aavso";
import { dateToJD } from "@/lib/astro";
import { jdToDate, toIsoDate, utcDate } from "@/lib/pozor";

const MAX_STARS = 8;
// hsl(var(--chart-1..8)) — the app's reserved multi-series chart palette.
const COLORS = Array.from({ length: MAX_STARS }, (_, i) => `hsl(var(--chart-${i + 1}))`);

type StarConfig = { id: string; name: string; t0: string; filter: string };
type Point = { day: number; mag: number; jd: number; band: string; observer: string; obsType: string };
type Series = { id: string; star: string; color: string; points: Point[]; limitPoints: Point[] };

function evenTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

// Open downward triangle — the standard AAVSO "fainter than" (upper-limit)
// symbol, colored per star via the stroke prop Scatter passes through.
function LimitMarker(props: { cx?: number; cy?: number; stroke?: string }) {
  const { cx, cy, stroke } = props;
  if (cx == null || cy == null) return null;
  const r = 4.5;
  const points = `${cx - r},${cy - r} ${cx + r},${cy - r} ${cx},${cy + r}`;
  return <polygon points={points} fill="none" stroke={stroke} strokeWidth={1.5} />;
}

function CompareTooltip({ active, payload }: { active?: boolean; payload?: { name?: string; payload: Point }[] }) {
  const { t } = useI18n();
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const p = entry.payload;
  return (
    <div className="rounded-md border border-border bg-background p-2 text-xs shadow-sm space-y-0.5">
      <div className="font-semibold">{entry.name}</div>
      <div>JD {p.jd.toFixed(5)} ({p.day >= 0 ? "+" : ""}{p.day.toFixed(2)} d)</div>
      <div>mag {p.mag.toFixed(2)}{p.band ? ` (${p.band})` : ""}</div>
      {p.observer && <div>{t("compare.tooltip.observer")}: {p.observer}</div>}
      {p.obsType && <div>{t("compare.tooltip.obsType")}: {p.obsType}</div>}
    </div>
  );
}

export default function Compare() {
  const { t } = useI18n();
  const [stars, setStars] = useState<StarConfig[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [rangeInput, setRangeInput] = useState("30");
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  const [queried, setQueried] = useState(false);

  const updateStar = (id: string, patch: Partial<StarConfig>) => {
    setStars(stars.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addStar = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (stars.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: t("compare.duplicate"), variant: "destructive" });
      return;
    }
    if (stars.length >= MAX_STARS) {
      toast({ title: t("compare.maxStars").replace("{n}", String(MAX_STARS)), variant: "destructive" });
      return;
    }
    setStars([...stars, { id: crypto.randomUUID(), name, t0: "", filter: "Vis." }]);
    setNameInput("");
  };

  const removeStar = (id: string) => {
    setStars(stars.filter((s) => s.id !== id));
    setSeries(series.filter((s) => s.id !== id));
  };

  const runComparison = async () => {
    const range = parseFloat(rangeInput);
    if (stars.length === 0) {
      toast({ title: t("compare.errNoStars"), variant: "destructive" });
      return;
    }
    if (!Number.isFinite(range) || range <= 0) {
      toast({ title: t("compare.errRange"), variant: "destructive" });
      return;
    }

    const jobs = stars
      .map((s, i) => ({ star: s, color: COLORS[i % COLORS.length], t0: parseFloat(s.t0) }))
      .filter(({ star, t0 }) => {
        if (!Number.isFinite(t0) || t0 <= 0) {
          toast({ title: t("compare.errT0").replace("{star}", star.name), variant: "destructive" });
          return false;
        }
        return true;
      });
    if (jobs.length === 0) return;

    setLoading(true);
    setQueried(true);
    const results = await Promise.allSettled(
      jobs.map(({ star, t0 }) => fetchAavsoObservations(star.name, t0 - range, t0 + range, star.filter)),
    );
    const nextSeries: Series[] = results.map((res, i) => {
      const { star, color, t0 } = jobs[i];
      if (res.status === "rejected") {
        toast({ title: t("compare.fetchError").replace("{star}", star.name), variant: "destructive" });
        return { id: star.id, star: star.name, color, points: [], limitPoints: [] };
      }
      if (res.value.length === 0) {
        toast({ title: t("compare.noData").replace("{star}", star.name) });
      }
      const toPoint = (o: AavsoObservation): Point => ({
        day: +(o.jd - t0).toFixed(5),
        mag: o.mag,
        jd: o.jd,
        band: o.band,
        observer: o.observer,
        obsType: o.obsType,
      });
      return {
        id: star.id,
        star: star.name,
        color,
        points: res.value.filter((o) => !o.fainterThan).map(toPoint),
        limitPoints: res.value.filter((o) => o.fainterThan).map(toPoint),
      };
    });
    setSeries(nextSeries);
    setLoading(false);
  };

  const range = parseFloat(rangeInput);
  const validRange = Number.isFinite(range) && range > 0;
  const allPoints = series.flatMap((s) => [...s.points, ...s.limitPoints]);
  const yDomain: [number, number] = allPoints.length
    ? [+(Math.min(...allPoints.map((p) => p.mag)) - 0.2).toFixed(2), +(Math.max(...allPoints.map((p) => p.mag)) + 0.2).toFixed(2)]
    : [0, 1];
  const xDomain: [number, number] = validRange ? [-range, range] : [-1, 1];

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl font-semibold mb-1">{t("compare.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("compare.subtitle")}</p>

        <Card className="p-4 mb-4">
          <div className="flex items-end gap-2 flex-wrap mb-4">
            <div className="space-y-1">
              <Label htmlFor="compare-star">{t("compare.addStar.label")}</Label>
              <Input
                id="compare-star"
                className="w-48"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStar(); } }}
                placeholder={t("compare.addStar.ph")}
              />
            </div>
            <Button type="button" variant="outline" onClick={addStar} disabled={!nameInput.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t("compare.add")}
            </Button>
          </div>

          {stars.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">{t("compare.noStars")}</p>
          ) : (
            <div className="mb-4">
              {stars.map((star, i) => {
                const t0Num = parseFloat(star.t0);
                const dateValue = Number.isFinite(t0Num) && t0Num > 0 ? toIsoDate(jdToDate(t0Num)) : "";
                return (
                  <div key={star.id} className="flex flex-wrap items-end gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-1.5 min-w-[9rem]">
                      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="font-medium text-sm truncate">{star.name}</span>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("compare.star.t0")}</Label>
                      <Input
                        className="w-36"
                        inputMode="decimal"
                        value={star.t0}
                        onChange={(e) => updateStar(star.id, { t0: e.target.value })}
                        placeholder={t("compare.star.t0.ph")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("compare.star.t0Date")}</Label>
                      <Input
                        type="date"
                        className="w-40"
                        value={dateValue}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const jd = dateToJD(utcDate(e.target.value, 0));
                          updateStar(star.id, { t0: jd.toFixed(5) });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("compare.star.filter")}</Label>
                      <Select value={star.filter} onValueChange={(v) => updateStar(star.id, { filter: v })}>
                        <SelectTrigger className="w-24 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AAVSO_BANDS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStar(star.id)}
                      aria-label={t("compare.remove")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label htmlFor="compare-range">{t("compare.range")}</Label>
              <Input
                id="compare-range"
                className="w-40"
                inputMode="decimal"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
              />
            </div>
            <Button type="button" onClick={runComparison} disabled={loading || stars.length === 0}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("compare.show")}
            </Button>
          </div>
        </Card>

        {queried && !loading && allPoints.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">{t("compare.noResults")}</Card>
        )}

        {queried && !loading && allPoints.length > 0 && (
          <Card className="p-4">
            <div className="w-full h-96">
              <ResponsiveContainer>
                <ComposedChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    type="number"
                    domain={xDomain}
                    ticks={evenTicks(xDomain[0], xDomain[1])}
                    tickFormatter={(v: number) => v.toFixed(1)}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: t("compare.xAxis"), position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis
                    reversed
                    domain={yDomain}
                    ticks={evenTicks(yDomain[0], yDomain[1])}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "mag", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <Tooltip content={<CompareTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {series.filter((s) => s.points.length > 0).map((s) => (
                    <Scatter
                      key={s.id}
                      data={s.points}
                      dataKey="mag"
                      fill={s.color}
                      isAnimationActive={false}
                      name={s.star}
                    />
                  ))}
                  {series.filter((s) => s.limitPoints.length > 0).map((s) => (
                    <Scatter
                      key={`${s.id}-limits`}
                      data={s.limitPoints}
                      dataKey="mag"
                      shape={LimitMarker}
                      stroke={s.color}
                      isAnimationActive={false}
                      name={`${s.star} (${t("graphs.curve.legend.limit")})`}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
