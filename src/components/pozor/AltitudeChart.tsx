import { useMemo } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useI18n } from "@/hooks/useI18n";
import {
  altAz, DEFAULT_NIGHT_RANGE, firstRisingCrossing, formatUT, hlohovecHorizonLimit,
  isHlohovecSite, minimaTimesInRange, sampleNight,
  type NightRange, type PozorLocation, type SampleTarget,
} from "@/lib/pozor";
import { CURVE_COLORS } from "./shared";

export interface AltitudeChartTarget {
  id: string;
  name: string;
  ra_hours: number;
  dec_deg: number;
  epoch_jd?: number | null;
  period_days?: number | null;
}

interface TooltipPayloadEntry {
  dataKey: string | number;
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  // Sun/Moon are context curves, not observation targets — the tooltip should only
  // call out the name and altitude of the target(s) actually being planned for.
  const targetsOnly = payload?.filter((p) => p.dataKey !== "sun" && p.dataKey !== "moon");
  if (!active || !targetsOnly?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5 shadow-sm">
      {targetsOnly.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium tabular-nums">{Number(p.value).toFixed(1)}°</span>
        </div>
      ))}
    </div>
  );
}

/** Sun-altitude thresholds marking sunset/sunrise and civil/nautical/astronomical twilight. */
const TWILIGHT_LABELS: { key: "sunset" | "civilDusk" | "nauticalDusk" | "astroDusk" | "astroDawn" | "nauticalDawn" | "civilDawn" | "sunrise"; label: string }[] = [
  { key: "sunset", label: "0°" },
  { key: "civilDusk", label: "-6°" },
  { key: "nauticalDusk", label: "-12°" },
  { key: "astroDusk", label: "-18°" },
  { key: "astroDawn", label: "-18°" },
  { key: "nauticalDawn", label: "-12°" },
  { key: "civilDawn", label: "-6°" },
  { key: "sunrise", label: "0°" },
];

/** Small upward triangle marking where a target clears the local eastern-horizon obstruction. */
function HorizonMarker(props: { cx?: number; cy?: number; color?: string }) {
  const { cx, cy, color } = props;
  if (cx == null || cy == null) return null;
  const r = 5;
  const points = `${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`;
  return <polygon points={points} fill={color} stroke="hsl(var(--card))" strokeWidth={1} />;
}

export function AltitudeChart({
  date,
  location,
  targets,
  minAltitude,
  range = DEFAULT_NIGHT_RANGE,
  height = 420,
  compact = false,
}: {
  date: string;
  location: PozorLocation;
  targets: AltitudeChartTarget[];
  minAltitude: number;
  range?: NightRange;
  height?: number;
  compact?: boolean;
}) {
  const { t } = useI18n();

  const { rows, night, twilight, fromDate, toDate } = useMemo(() => {
    const sampleTargets: SampleTarget[] = targets.map((x) => ({
      key: x.id,
      raHours: x.ra_hours,
      decDeg: x.dec_deg,
    }));
    const { samples, night, twilight, fromDate, toDate } = sampleNight(date, location, sampleTargets, 10, range);
    const rows = samples.map((s) => {
      const row: Record<string, number | string> = {
        minutes: s.minutes,
        label: formatUT(s.date),
        moon: Number(s.moonAlt.toFixed(2)),
        sun: Number(s.sunAlt.toFixed(2)),
      };
      for (const tg of targets) row[tg.id] = Number(s.targets[tg.id].toFixed(2));
      return row;
    });
    return { rows, night, twilight, fromDate, toDate };
  }, [date, location, targets, range]);

  const minMinutes = (rows[0]?.minutes as number) ?? 0;
  const maxMinutes = (rows[rows.length - 1]?.minutes as number) ?? 0;
  const toMinutes = (d: Date | null): number | null => (d ? (d.getTime() - fromDate.getTime()) / 60000 : null);

  const darkFrom = toMinutes(night.start);
  const darkTo = toMinutes(night.end);

  const twilightLines = useMemo(() => {
    return TWILIGHT_LABELS.map(({ key, label }) => ({
      key,
      label,
      minutes: toMinutes(twilight[key]),
    })).filter(
      (l) => l.minutes != null && l.minutes >= minMinutes && l.minutes <= maxMinutes,
    ) as { key: string; label: string; minutes: number }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twilight, fromDate, minMinutes, maxMinutes]);

  const hourTicks = useMemo(() => {
    const startMs = fromDate.getTime();
    const first = new Date(startMs);
    first.setUTCSeconds(0, 0);
    first.setUTCMinutes(0);
    if (first.getTime() < startMs) first.setTime(first.getTime() + 3600e3);
    const ticks: number[] = [];
    // Label each tick from its real whole-hour Date, not by re-deriving it from the
    // (fractional-second) fromDate — that reintroduction of drift used to show "15:59"
    // for a tick that was actually exactly 16:00.
    const labels = new Map<number, string>();
    for (let t = first.getTime(); t <= toDate.getTime(); t += 3600e3) {
      const minutes = Math.round((t - startMs) / 60000);
      ticks.push(minutes);
      labels.set(minutes, formatUT(new Date(t)));
    }
    return { ticks, labels };
  }, [fromDate, toDate]);

  const minimaMarks = useMemo(() => {
    const out: { key: string; minutes: number; alt: number; color: string; kind: "primary" | "secondary" }[] = [];
    targets.forEach((tg, i) => {
      if (!tg.epoch_jd || !tg.period_days) return;
      const events = minimaTimesInRange({ epochJd: tg.epoch_jd, periodDays: tg.period_days }, fromDate, toDate);
      for (const ev of events) {
        const minutes = toMinutes(ev.date);
        if (minutes == null) continue;
        const alt = altAz(tg.ra_hours, tg.dec_deg, ev.date, location).altDeg;
        if (alt < 0 || alt > 90) continue;
        out.push({
          key: `${tg.id}-${ev.kind}-${ev.epoch}`,
          minutes,
          alt,
          color: CURVE_COLORS[i % CURVE_COLORS.length],
          kind: ev.kind,
        });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, fromDate, toDate, location]);

  const horizonMarks = useMemo(() => {
    if (!isHlohovecSite(location)) return [];
    const out: { key: string; minutes: number; alt: number; color: string; time: string }[] = [];
    targets.forEach((tg, i) => {
      const limit = hlohovecHorizonLimit(tg.dec_deg);
      const samples = rows.map((r) => ({ minutes: r.minutes as number, alt: r[tg.id] as number }));
      const crossing = firstRisingCrossing(samples, limit);
      if (!crossing) return;
      out.push({
        key: tg.id,
        minutes: crossing.minutes,
        alt: crossing.altDeg,
        color: CURVE_COLORS[i % CURVE_COLORS.length],
        time: formatUT(new Date(fromDate.getTime() + crossing.minutes * 60e3)),
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, rows, location, fromDate]);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: compact ? 8 : 20, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            {darkFrom != null && darkTo != null && (
              <ReferenceArea x1={darkFrom} x2={darkTo} fill="hsl(var(--primary))" fillOpacity={0.06} />
            )}
            <ReferenceLine
              y={minAltitude}
              stroke="hsl(var(--destructive))"
              strokeDasharray="4 4"
              label={
                compact
                  ? undefined
                  : { value: `${minAltitude}°`, fill: "hsl(var(--muted-foreground))", fontSize: 11 }
              }
            />
            {twilightLines.map((l) => (
              <ReferenceLine
                key={l.key}
                x={l.minutes}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="2 2"
                strokeOpacity={0.6}
                label={
                  compact
                    ? undefined
                    : { value: l.label, position: "top", fill: "hsl(var(--muted-foreground))", fontSize: 9 }
                }
              />
            ))}
            {minimaMarks.map((m) => (
              <ReferenceDot
                key={m.key}
                x={m.minutes}
                y={m.alt}
                r={compact ? 3 : 4}
                fill={m.kind === "primary" ? m.color : "hsl(var(--card))"}
                stroke={m.color}
                strokeWidth={1.5}
                isFront
              />
            ))}
            {horizonMarks.map((m) => (
              <ReferenceDot
                key={`horizon-${m.key}`}
                x={m.minutes}
                y={m.alt}
                r={5}
                shape={(props: { cx?: number; cy?: number }) => <HorizonMarker {...props} color={m.color} />}
                isFront
                label={
                  compact
                    ? undefined
                    : {
                        value: t("pozor.horizonSafeFrom").replace("{time}", m.time),
                        position: "top",
                        fill: m.color,
                        fontSize: 9,
                      }
                }
              />
            ))}
            <XAxis
              dataKey="minutes"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={hourTicks.ticks}
              tickFormatter={(v) => hourTicks.labels.get(Number(v)) ?? ""}
              stroke="hsl(var(--muted-foreground))"
              fontSize={compact ? 9 : 11}
            />
            <YAxis
              domain={[0, 90]}
              allowDataOverflow
              tickFormatter={(v) => `${Math.round(Number(v))}°`}
              stroke="hsl(var(--muted-foreground))"
              fontSize={compact ? 9 : 11}
              width={compact ? 26 : 32}
            />
            <Tooltip content={<ChartTooltip />} wrapperStyle={{ zIndex: 30 }} />
            <Line
              dataKey="sun"
              name={t("pozor.sun")}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 3"
              dot={false}
              strokeWidth={1}
              isAnimationActive={false}
            />
            <Line
              dataKey="moon"
              name={t("pozor.moon")}
              stroke="hsl(var(--accent))"
              strokeDasharray="6 3"
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            {targets.map((x, i) => (
              <Line
                key={x.id}
                dataKey={x.id}
                name={x.name}
                stroke={CURVE_COLORS[i % CURVE_COLORS.length]}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!compact && targets.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs">
          {targets.map((x, i) => (
            <span key={x.id} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: CURVE_COLORS[i % CURVE_COLORS.length] }}
              />
              <span className="text-muted-foreground">{x.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
