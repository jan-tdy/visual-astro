import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { duskTime, moonAltitude, moonPhaseAt, toIsoDate } from "@/lib/pozor";
import { LocationPicker } from "./Controls";
import {
  downloadText,
  resolveLocation,
  todayIso,
  type PozorLocationRow,
  type PozorSettings,
} from "./shared";

interface DayPhase {
  isoDate: string;
  day: number;
  emoji: string;
  pct: number | null;
  up: boolean;
}

const DAY_MS = 86400e3;

function moonEmoji(pct: number | null, waxing: boolean): string {
  if (pct === null) return "❔";
  if (pct < 5) return "🌑";
  if (pct < 40) return waxing ? "🌒" : "🌘";
  if (pct < 60) return waxing ? "🌓" : "🌗";
  if (pct < 95) return waxing ? "🌔" : "🌖";
  return "🌕";
}

function computeYear(year: number, location: ReturnType<typeof resolveLocation>): DayPhase[] {
  const startMs = Date.UTC(year, 0, 1);
  const dayCount = Math.round((Date.UTC(year + 1, 0, 1) - startMs) / DAY_MS);
  const days: DayPhase[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startMs + i * DAY_MS);
    const isoDate = toIsoDate(d);
    const obs = duskTime(isoDate, location);
    if (obs) {
      const { pct, waxing } = moonPhaseAt(obs);
      const up = moonAltitude(obs, location) > 0;
      days.push({ isoDate, day: d.getUTCDate(), emoji: moonEmoji(pct, waxing), pct, up });
    } else {
      days.push({ isoDate, day: d.getUTCDate(), emoji: "❔", pct: null, up: false });
    }
  }
  return days;
}

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MoonCalendar({
  year,
  setYear,
  settings,
  setSettings,
  locations,
}: {
  year: number;
  setYear: (y: number) => void;
  settings: PozorSettings;
  setSettings: (s: PozorSettings) => void;
  locations: PozorLocationRow[];
}) {
  const { t, lang } = useI18n();
  const location = resolveLocation(locations, settings.locationId);
  // A full year of dusk/illumination searches isn't cheap — depend on the
  // location's own fields rather than the freshly-resolved `location` object
  // (a new reference every render) so unrelated re-renders don't recompute it.
  const days = useMemo(
    () => computeYear(year, location),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, location.key, location.lat, location.lon, location.elevation],
  );
  const today = todayIso();

  const monthNameOf = (m: number) =>
    new Date(Date.UTC(2000, m, 1)).toLocaleString(lang === "sk" ? "sk-SK" : "en-US", {
      month: "long",
      timeZone: "UTC",
    }) || MONTH_NAMES_EN[m];

  const exportCsv = () => {
    const rows = [
      "Date,Phase,Up,Illumination %",
      ...days.map((d) => `${d.isoDate},${d.emoji},${d.up},${d.pct !== null ? d.pct.toFixed(1) : ""}`),
    ];
    downloadText(`moon-phases-${year}.csv`, rows.join("\n"), "text/csv");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={() => setYear(year - 1)}
            title={t("pozor.moon.prevYear")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-sm font-medium tabular-nums">{year}</span>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={() => setYear(year + 1)}
            title={t("pozor.moon.nextYear")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <LocationPicker settings={settings} setSettings={setSettings} locations={locations} />
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" /> {t("pozor.cat.export")}
        </Button>
      </Card>

      <Card className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">{t("pozor.moon.subtitle")}</p>
        {Array.from({ length: 12 }, (_, m) => {
          const monthDays = days.filter((d) => d.isoDate.slice(5, 7) === String(m + 1).padStart(2, "0"));
          return (
            <div key={m} className="space-y-1.5">
              <h3 className="text-sm font-semibold capitalize">{monthNameOf(m)}</h3>
              <div className="flex flex-wrap gap-1">
                {monthDays.map((d) => (
                  <div
                    key={d.isoDate}
                    title={`${d.isoDate}${d.pct !== null ? ` — ${d.pct.toFixed(0)}%` : ""}`}
                    className={`flex flex-col items-center justify-center rounded-md border w-10 h-12 shrink-0 ${
                      d.isoDate === today ? "border-primary ring-1 ring-primary" : "border-border/60"
                    }`}
                  >
                    <span className="text-base leading-none">{d.emoji}</span>
                    <span className="text-[9px] leading-none mt-0.5">{!d.up && d.pct !== null ? "⭐" : " "}</span>
                    <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground pt-2 border-t border-border/60">{t("pozor.moon.legend")}</p>
      </Card>
    </div>
  );
}
