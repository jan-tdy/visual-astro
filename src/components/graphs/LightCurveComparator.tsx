import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Line, Scatter,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/useI18n";
import { fetchAavsoObservations } from "@/lib/aavso";

const MAX_STARS = 8;
// hsl(var(--chart-1..8)) — the app's reserved multi-series chart palette, unused elsewhere so far.
const COLORS = Array.from({ length: MAX_STARS }, (_, i) => `hsl(var(--chart-${i + 1}))`);

type Point = { day: number; mag: number; jd: number };
type Series = { star: string; color: string; points: Point[]; limitPoints: Point[] };

function evenTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

// Open downward triangle — same "fainter than" convention as the single-star
// light curve tab, colored per star via the stroke prop Scatter passes through.
function LimitMarker(props: { cx?: number; cy?: number; stroke?: string }) {
  const { cx, cy, stroke } = props;
  if (cx == null || cy == null) return null;
  const r = 4.5;
  const points = `${cx - r},${cy - r} ${cx + r},${cy - r} ${cx},${cy + r}`;
  return <polygon points={points} fill="none" stroke={stroke} strokeWidth={1.5} />;
}

export function LightCurveComparator() {
  const { t } = useI18n();
  const [stars, setStars] = useState<string[]>([]);
  const [starInput, setStarInput] = useState("");
  const [t0Input, setT0Input] = useState("");
  const [rangeInput, setRangeInput] = useState("30");
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  const [queried, setQueried] = useState(false);

  const addStar = () => {
    const name = starInput.trim();
    if (!name) return;
    if (stars.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast({ title: t("graphs.compare.duplicate"), variant: "destructive" });
      return;
    }
    if (stars.length >= MAX_STARS) {
      toast({ title: t("graphs.compare.maxStars").replace("{n}", String(MAX_STARS)), variant: "destructive" });
      return;
    }
    setStars([...stars, name]);
    setStarInput("");
  };

  const removeStar = (name: string) => {
    setStars(stars.filter((s) => s !== name));
    setSeries(series.filter((s) => s.star !== name));
  };

  const runComparison = async () => {
    const t0 = parseFloat(t0Input);
    const range = parseFloat(rangeInput);
    if (stars.length === 0) {
      toast({ title: t("graphs.compare.errNoStars"), variant: "destructive" });
      return;
    }
    if (!Number.isFinite(t0) || t0 <= 0) {
      toast({ title: t("graphs.compare.errT0"), variant: "destructive" });
      return;
    }
    if (!Number.isFinite(range) || range <= 0) {
      toast({ title: t("graphs.compare.errRange"), variant: "destructive" });
      return;
    }

    setLoading(true);
    setQueried(true);
    const results = await Promise.allSettled(
      stars.map((star) => fetchAavsoObservations(star, t0 - range, t0 + range)),
    );
    const nextSeries: Series[] = [];
    results.forEach((res, i) => {
      const star = stars[i];
      const color = COLORS[i % COLORS.length];
      if (res.status === "rejected") {
        toast({ title: t("graphs.compare.fetchError").replace("{star}", star), variant: "destructive" });
        nextSeries.push({ star, color, points: [], limitPoints: [] });
        return;
      }
      if (res.value.length === 0) {
        toast({ title: t("graphs.compare.noData").replace("{star}", star) });
      }
      const toPoint = (o: (typeof res.value)[number]) => ({ day: +(o.jd - t0).toFixed(5), mag: o.mag, jd: o.jd });
      nextSeries.push({
        star,
        color,
        points: res.value.filter((o) => !o.fainterThan).map(toPoint),
        limitPoints: res.value.filter((o) => o.fainterThan).map(toPoint),
      });
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
    <Card className="p-4">
      <h3 className="font-semibold mb-1">{t("graphs.compare.title")}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t("graphs.compare.desc")}</p>

      <div className="flex items-end gap-2 flex-wrap mb-3">
        <div className="space-y-1">
          <Label htmlFor="compare-star">{t("graphs.compare.addStar.label")}</Label>
          <Input
            id="compare-star"
            className="w-48"
            value={starInput}
            onChange={(e) => setStarInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStar(); } }}
            placeholder={t("graphs.compare.addStar.ph")}
          />
        </div>
        <Button type="button" variant="outline" onClick={addStar} disabled={!starInput.trim()}>
          <Plus className="h-4 w-4 mr-1" /> {t("graphs.compare.add")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {stars.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("graphs.compare.noStars")}</p>
        ) : (
          stars.map((s, i) => (
            <Badge key={s} variant="secondary" className="gap-1.5 pr-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {s}
              <button
                type="button"
                onClick={() => removeStar(s)}
                aria-label={t("graphs.compare.remove")}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <div className="flex items-end gap-3 flex-wrap mb-4">
        <div className="space-y-1">
          <Label htmlFor="compare-t0">{t("graphs.compare.t0")}</Label>
          <Input
            id="compare-t0"
            className="w-40"
            inputMode="decimal"
            value={t0Input}
            onChange={(e) => setT0Input(e.target.value)}
            placeholder={t("graphs.compare.t0.ph")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="compare-range">{t("graphs.compare.range")}</Label>
          <Input
            id="compare-range"
            className="w-32"
            inputMode="decimal"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
          />
        </div>
        <Button type="button" onClick={runComparison} disabled={loading || stars.length === 0}>
          {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {t("graphs.compare.show")}
        </Button>
      </div>

      {queried && !loading && allPoints.length === 0 && (
        <p className="text-sm text-muted-foreground p-6 text-center">{t("graphs.curve.empty")}</p>
      )}

      {queried && !loading && allPoints.length > 0 && (
        <div className="w-full h-80">
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
                label={{ value: t("graphs.compare.xAxis"), position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <YAxis
                reversed
                domain={yDomain}
                ticks={evenTicks(yDomain[0], yDomain[1])}
                tickFormatter={(v: number) => v.toFixed(2)}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                label={{ value: "mag", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v: number, name: string) => [v.toFixed(2), name]}
              />
              {series.filter((s) => s.points.length > 0).map((s) => (
                <Line
                  key={s.star}
                  data={s.points}
                  type="linear"
                  dataKey="mag"
                  stroke={s.color}
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: s.color }}
                  isAnimationActive={false}
                  connectNulls={false}
                  name={s.star}
                />
              ))}
              {series.filter((s) => s.limitPoints.length > 0).map((s) => (
                <Scatter
                  key={`${s.star}-limits`}
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
      )}
    </Card>
  );
}
