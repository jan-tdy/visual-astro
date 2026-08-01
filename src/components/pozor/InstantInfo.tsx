import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import {
  formatDMS, formatHMS, instantInfo, parseUtHours, utcDate,
} from "@/lib/pozor";
import { resolveLocation, todayIso, type CcdTarget, type PozorLocationRow, type PozorSettings } from "./shared";
import { DateField, LocationPicker, TargetPicker } from "./Controls";

export function InstantInfo({
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
  const [date, setDate] = useState(todayIso());
  const [ut, setUt] = useState("22:00:00");
  const location = resolveLocation(locations, settings.locationId);
  const target = targets.find((x) => x.id === targetId);

  const info = useMemo(() => {
    const hours = parseUtHours(ut);
    if (!target || hours == null) return null;
    return instantInfo(target.ra_hours, target.dec_deg, utcDate(date, hours), location);
  }, [target, date, ut, location]);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <TargetPicker targets={targets} value={targetId} onChange={setTargetId} />
        <DateField label={t("pozor.date")} value={date} onChange={setDate} />
        <div className="space-y-1">
          <Label className="text-xs">{t("pozor.utTime")}</Label>
          <Input className="w-[130px] h-9" value={ut} onChange={(e) => setUt(e.target.value)} placeholder="22:00:00" />
        </div>
        <LocationPicker settings={settings} setSettings={setSettings} locations={locations} />
      </Card>

      <Card className="p-4">
        {!info ? (
          <p className="text-sm text-muted-foreground">{t("pozor.pickTarget")}</p>
        ) : (
          <div className="grid gap-x-8 sm:grid-cols-2 text-sm">
            <Row label="JD" value={info.jd.toFixed(5)} />
            <Row label="JD hel." value={info.jdHel.toFixed(5)} />
            <Row label={t("pozor.helCorr")} value={`${info.helCorrDays.toFixed(5)} d`} />
            <Row label={t("pozor.rv")} value={`${info.rvKmS.toFixed(5)} km/s`} />
            <Row label="LST" value={formatHMS(info.lstHours)} />
            <Row label={t("pozor.hourAngle")} value={formatHMS(info.haHours)} />
            <Row label={t("pozor.alt")} value={formatDMS(info.altDeg)} />
            <Row label={t("pozor.azimuth")} value={formatDMS(info.azDeg)} />
            <Row label={t("pozor.airmass")} value={info.airmass ? info.airmass.toFixed(5) : t("pozor.belowHorizon")} />
            <Row label={t("pozor.raOfDate")} value={formatHMS(info.raOfDate)} />
            <Row label={t("pozor.decOfDate")} value={formatDMS(info.decOfDate)} />
          </div>
        )}
      </Card>
    </div>
  );
}
