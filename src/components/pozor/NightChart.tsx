import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { formatUT, nightInfo } from "@/lib/pozor";
import { AltitudeChart } from "./AltitudeChart";
import { resolveLocation, todayIso, type CcdTarget, type PozorLocationRow, type PozorSettings } from "./shared";
import { DateField, LocationPicker, MultiTargetPicker } from "./Controls";

export function NightChart({
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
  const [date, setDate] = useState(todayIso());
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<"single" | "grid">("single");
  const [page, setPage] = useState(0);
  const location = resolveLocation(locations, settings.locationId);

  const chosen = useMemo(
    () => targets.filter((x) => selected.includes(x.id)),
    [targets, selected],
  );

  const night = useMemo(() => nightInfo(date, location), [date, location]);

  const pageCount = Math.max(1, Math.ceil(targets.length / 6));
  const pageTargets = targets.slice(page * 6, page * 6 + 6);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <DateField label={t("pozor.date")} value={date} onChange={setDate} />
        {view === "single" && (
          <MultiTargetPicker
            targets={targets}
            values={selected}
            onToggle={(id) =>
              setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
          />
        )}
        <LocationPicker settings={settings} setSettings={setSettings} locations={locations} />
        <div className="flex-1" />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={view === "single" ? "default" : "outline"}
            onClick={() => setView("single")}
          >
            {t("pozor.chart.viewSingle")}
          </Button>
          <Button
            size="sm"
            variant={view === "grid" ? "default" : "outline"}
            onClick={() => setView("grid")}
          >
            {t("pozor.chart.viewGrid")}
          </Button>
        </div>
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

        {view === "single" ? (
          <>
            <AltitudeChart date={date} location={location} targets={chosen} minAltitude={settings.minAltitude} />
            {!chosen.length && <p className="text-sm text-muted-foreground">{t("pozor.chart.hint")}</p>}
          </>
        ) : (
          <div className="space-y-3">
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("pozor.chart.hint")}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    title={t("pozor.chart.prevSix")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t("pozor.chart.pageOf")
                      .replace("{a}", String(page * 6 + 1))
                      .replace("{b}", String(Math.min(targets.length, page * 6 + 6)))
                      .replace("{n}", String(targets.length))}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    title={t("pozor.chart.nextSix")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pageTargets.map((x) => (
                    <div key={x.id} className="space-y-1">
                      <p className="text-xs font-medium truncate" title={x.name}>
                        {x.name} <span className="text-muted-foreground">{x.constellation}</span>
                      </p>
                      <AltitudeChart
                        date={date}
                        location={location}
                        targets={[x]}
                        minAltitude={settings.minAltitude}
                        height={200}
                        compact
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
