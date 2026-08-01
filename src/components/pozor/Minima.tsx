import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { formatUT, minimaInRange, toIsoDate } from "@/lib/pozor";
import { downloadText, resolveLocation, todayIso, type CcdTarget, type PozorLocationRow, type PozorSettings } from "./shared";
import { DateField, LocationPicker, TargetPicker } from "./Controls";

export function Minima({
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
  const [to, setTo] = useState(() => new Date(Date.now() + 29 * 86400e3).toISOString().slice(0, 10));
  const location = resolveLocation(locations, settings.locationId);
  const target = targets.find((x) => x.id === targetId);
  const usable = !!target?.epoch_jd && !!target?.period_days;

  const rows = useMemo(() => {
    if (!target || !usable) return [];
    return minimaInRange(
      {
        raHours: target.ra_hours,
        decDeg: target.dec_deg,
        epochJd: target.epoch_jd as number,
        periodDays: target.period_days as number,
      },
      from,
      to,
      location,
      settings.minAltitude,
      true,
    );
  }, [target, usable, from, to, location, settings.minAltitude]);

  const csv = () => {
    const head = "epoch;jd_geo;jd_hel;hel_corr_days;date_ut;time_ut;altitude_deg;airmass";
    const lines = rows.map((r) =>
      [
        r.epoch,
        r.jd.toFixed(5),
        r.jdHel.toFixed(5),
        r.helCorrDays.toFixed(5),
        toIsoDate(r.date),
        formatUT(r.date, true),
        r.altDeg.toFixed(2),
        r.airmass ? r.airmass.toFixed(3) : "",
      ].join(";"),
    );
    downloadText(`pozor_minima_${target?.name ?? ""}_${from}.csv`, [head, ...lines].join("\n"), "text/csv");
  };

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
          <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!rows.length}>
            <Printer className="h-4 w-4 mr-1" /> {t("pozor.print")}
          </Button>
        </div>
      </Card>

      <Card className="p-4 overflow-x-auto">
        {!target ? (
          <p className="text-sm text-muted-foreground">{t("pozor.pickTarget")}</p>
        ) : !usable ? (
          <p className="text-sm text-muted-foreground">{t("pozor.minima.needEpoch")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pozor.minima.none")}</p>
        ) : (
          <table className="w-full text-xs tabular-nums">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2">E</th>
                <th className="text-left py-2 pr-2">{t("pozor.date")}</th>
                <th className="text-left py-2 pr-2">UT</th>
                <th className="text-left py-2 pr-2">JD</th>
                <th className="text-left py-2 pr-2">JD hel.</th>
                <th className="text-left py-2 pr-2">{t("pozor.helCorr")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.alt")}</th>
                <th className="text-left py-2">{t("pozor.airmass")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.epoch} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{r.epoch}</td>
                  <td className="py-1.5 pr-2">{toIsoDate(r.date)}</td>
                  <td className="py-1.5 pr-2">{formatUT(r.date, true)}</td>
                  <td className="py-1.5 pr-2">{r.jd.toFixed(5)}</td>
                  <td className="py-1.5 pr-2">{r.jdHel.toFixed(5)}</td>
                  <td className="py-1.5 pr-2">{r.helCorrDays.toFixed(5)}</td>
                  <td className="py-1.5 pr-2">{r.altDeg.toFixed(1)}°</td>
                  <td className="py-1.5">{r.airmass ? r.airmass.toFixed(3) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
