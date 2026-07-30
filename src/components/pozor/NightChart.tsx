import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useI18n } from "@/hooks/useI18n";
import { formatUT, sampleNight, type SampleTarget } from "@/lib/pozor";
import { CURVE_COLORS, todayIso, type CcdTarget, type PozorSettings } from "./shared";
import { DateField, LocationPicker, MultiTargetPicker } from "./Controls";
import { getLocation } from "@/lib/pozor";

export function NightChart({
  targets,
  settings,
  setSettings,
}: {
  targets: CcdTarget[];
  settings: PozorSettings;
  setSettings: (s: PozorSettings) => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(todayIso());
  const [selected, setSelected] = useState<string[]>([]);
  const location = getLocation(settings.locationKey);

  const chosen = useMemo(
    () => targets.filter((x) => selected.includes(x.id)),
    [targets, selected],
  );

  const { rows, night } = useMemo(() => {
    const sampleTargets: SampleTarget[] = chosen.map((x) => ({
      key: x.id,
      raHours: x.ra_hours,
      decDeg: x.dec_deg,
    }));
    const { samples, night } = sampleNight(date, location, sampleTargets, 10);
    const rows = samples.map((s) => {
      const row: Record<string, number | string> = {
        minutes: s.minutes,
        label: formatUT(s.date),
        moon: Number(s.moonAlt.toFixed(2)),
        sun: Number(s.sunAlt.toFixed(2)),
      };
      for (const tg of chosen) row[tg.id] = Number(s.targets[tg.id].toFixed(2));
      return row;
    });
    return { rows, night };
  }, [date, location, chosen]);

  const darkFrom = night.start ? rows.find((r) => r.label === formatUT(night.start!))?.minutes : undefined;
  const darkTo = night.end ? rows.find((r) => r.label === formatUT(night.end!))?.minutes : undefined;

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <DateField label={t("pozor.date")} value={date} onChange={setDate} />
        <MultiTargetPicker
          targets={targets}
          values={selected}
          onToggle={(id) =>
            setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />
        <LocationPicker settings={settings} setSettings={setSettings} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t("pozor.nightStart")}: <span className="text-foreground">{formatUT(night.start, true)} UT</span>
          </span>
          <span>
            {t("pozor.nightEnd")}: <span className="text-foreground">{formatUT(night.end, true)} UT</span>
          </span>
          <span>
            {t("pozor.moonPhase")}:{" "}
            <span className="text-foreground">{night.moonPhasePercent.toFixed(0)} %</span>
          </span>
          <span>
            {t("pozor.moonRise")}: <span className="text-foreground">{formatUT(night.moonRise)}</span>
          </span>
          <span>
            {t("pozor.moonSet")}: <span className="text-foreground">{formatUT(night.moonSet)}</span>
          </span>
        </div>

        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              {darkFrom != null && darkTo != null && (
                <ReferenceArea
                  x1={darkFrom as number}
                  x2={darkTo as number}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.06}
                />
              )}
              <ReferenceLine
                y={settings.minAltitude}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 4"
                label={{ value: `${settings.minAltitude}°`, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <XAxis
                dataKey="minutes"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => rows.find((r) => r.minutes === v)?.label as string ?? ""}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis
                domain={[-30, 90]}
                tickFormatter={(v) => `${Math.round(Number(v))}°`}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `${rows.find((r) => r.minutes === v)?.label ?? ""} UT`}
                formatter={(value: any, name: any) => [
                  `${Number(value).toFixed(1)}°`,
                  name === "moon"
                    ? t("pozor.moonAlt")
                    : name === "sun"
                      ? t("pozor.sunAlt")
                      : (targets.find((x) => x.id === name)?.name ?? name),
                ]}
              />
              <Line
                dataKey="sun"
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="2 3"
                dot={false}
                strokeWidth={1}
              />
              <Line dataKey="moon" stroke="hsl(var(--accent))" strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
              {chosen.map((x, i) => (
                <Line
                  key={x.id}
                  dataKey={x.id}
                  stroke={CURVE_COLORS[i % CURVE_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!chosen.length && <p className="text-sm text-muted-foreground">{t("pozor.chart.hint")}</p>}
      </Card>
    </div>
  );
}