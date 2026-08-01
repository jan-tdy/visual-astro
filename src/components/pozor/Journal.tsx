import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { buildJournal, formatUT } from "@/lib/pozor";
import { downloadText, resolveLocation, todayIso, type CcdTarget, type PozorLocationRow, type PozorSettings } from "./shared";
import { DateField, LocationPicker, TargetPicker } from "./Controls";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Journal({
  targets,
  settings,
  setSettings,
  locations,
}: {
  targets: CcdTarget[];
  settings: PozorSettings;
  setSettings: (s: PozorSettings) => void;
  locations: PozorLocationRow[];
}) {
  const { t } = useI18n();
  const [targetId, setTargetId] = useState("");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(() => new Date(Date.now() + 13 * 86400e3).toISOString().slice(0, 10));
  const location = resolveLocation(locations, settings.locationId);
  const target = targets.find((x) => x.id === targetId);

  const rows = useMemo(() => {
    if (!target) return [];
    return buildJournal(
      {
        raHours: target.ra_hours,
        decDeg: target.dec_deg,
        epochJd: target.epoch_jd,
        periodDays: target.period_days,
      },
      from,
      to,
      location,
      settings.minAltitude,
    );
  }, [target, from, to, location, settings.minAltitude]);

  const csv = () => {
    const head = "date;weekday;jd;moon_percent;night_start;night_end;moon_rise;moon_set;window_from;window_to;phase_from;phase_to;alt_max";
    const lines = rows.map((r) =>
      [
        r.isoDate,
        WEEKDAYS[r.weekday],
        r.jdMidnight.toFixed(4),
        r.night.moonPhasePercent.toFixed(0),
        formatUT(r.night.start),
        formatUT(r.night.end),
        formatUT(r.night.moonRise),
        formatUT(r.night.moonSet),
        r.windows[0] ? formatUT(r.windows[0].from) : "",
        r.windows[0] ? formatUT(r.windows[0].to) : "",
        r.phaseFrom != null ? r.phaseFrom.toFixed(4) : "",
        r.phaseTo != null ? r.phaseTo.toFixed(4) : "",
        r.altMax > -90 ? r.altMax.toFixed(1) : "",
      ].join(";"),
    );
    downloadText(`pozor_dennik_${target?.name ?? ""}_${from}.csv`, [head, ...lines].join("\n"), "text/csv");
  };

  const json = () =>
    downloadText(
      `pozor_dennik_${target?.name ?? ""}_${from}.json`,
      JSON.stringify(rows, null, 2),
      "application/json",
    );

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <TargetPicker targets={targets} value={targetId} onChange={setTargetId} />
        <DateField label={t("pozor.from")} value={from} onChange={setFrom} />
        <DateField label={t("pozor.to")} value={to} onChange={setTo} />
        <LocationPicker settings={settings} setSettings={setSettings} locations={locations} />
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={json} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!rows.length}>
            <Printer className="h-4 w-4 mr-1" /> {t("pozor.print")}
          </Button>
        </div>
      </Card>

      <Card className="p-4 overflow-x-auto">
        {!target ? (
          <p className="text-sm text-muted-foreground">{t("pozor.pickTarget")}</p>
        ) : (
          <table className="w-full text-xs tabular-nums">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2">{t("pozor.date")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.weekday")}</th>
                <th className="text-left py-2 pr-2">JD</th>
                <th className="text-left py-2 pr-2">{t("pozor.moonPhase")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.nightStart")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.nightEnd")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.moonRise")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.moonSet")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.window")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.phaseEdges")}</th>
                <th className="text-left py-2">{t("pozor.altMax")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.isoDate} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{r.isoDate}</td>
                  <td className="py-1.5 pr-2">{WEEKDAYS[r.weekday]}</td>
                  <td className="py-1.5 pr-2">{r.jdMidnight.toFixed(3)}</td>
                  <td className="py-1.5 pr-2">{r.night.moonPhasePercent.toFixed(0)} %</td>
                  <td className="py-1.5 pr-2">{formatUT(r.night.start)}</td>
                  <td className="py-1.5 pr-2">{formatUT(r.night.end)}</td>
                  <td className="py-1.5 pr-2">{formatUT(r.night.moonRise)}</td>
                  <td className="py-1.5 pr-2">{formatUT(r.night.moonSet)}</td>
                  <td className="py-1.5 pr-2">
                    {r.windows.length
                      ? r.windows.map((w, i) => (
                          <span key={i} className="mr-2">
                            {formatUT(w.from)}–{formatUT(w.to)}
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.phaseFrom != null && r.phaseTo != null
                      ? `${r.phaseFrom.toFixed(3)} → ${r.phaseTo.toFixed(3)}`
                      : "—"}
                  </td>
                  <td className="py-1.5">{r.altMax > -90 ? `${r.altMax.toFixed(1)}°` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}