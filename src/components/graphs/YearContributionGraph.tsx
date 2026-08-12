import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { HEATMAP_LEVEL_ALPHA, heatmapCellColor } from "./contributionColor";

const DAY_MS = 86400e3;

interface DayCell {
  date: Date;
  isoDate: string;
  count: number;
  inYear: boolean;
}

// Sunday-anchored week grid running from the Sunday on/before Jan 1 to the
// Saturday on/after Dec 31 — the same layout GitHub's contribution graph uses.
function buildWeeks(year: number, counts: Map<string, number>): DayCell[][] {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const gridStart = new Date(jan1);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(dec31);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const days: DayCell[] = [];
  for (let ms = gridStart.getTime(); ms <= gridEnd.getTime(); ms += DAY_MS) {
    const d = new Date(ms);
    const isoDate = d.toISOString().slice(0, 10);
    days.push({ date: d, isoDate, count: counts.get(isoDate) ?? 0, inYear: d.getUTCFullYear() === year });
  }
  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function YearContributionGraph({
  counts,
  year,
  onYearChange,
}: {
  counts: Map<string, number>;
  year: number;
  onYearChange: (year: number) => void;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "sk" ? "sk-SK" : "en-US";

  const weeks = useMemo(() => buildWeeks(year, counts), [year, counts]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const [key, count] of counts) if (key.startsWith(String(year)) && count > m) m = count;
    return m;
  }, [counts, year]);

  const totalYear = useMemo(() => {
    let sum = 0;
    for (const [key, count] of counts) if (key.startsWith(String(year))) sum += count;
    return sum;
  }, [counts, year]);

  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const firstOfYear = week.find((d) => d.inYear);
      if (!firstOfYear) return;
      const m = firstOfYear.date.getUTCMonth();
      if (m !== lastMonth) {
        labels.push({ col, label: firstOfYear.date.toLocaleString(locale, { month: "short", timeZone: "UTC" }) });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks, locale]);

  const weekdayLabel = (i: number) =>
    new Date(Date.UTC(2023, 0, 1 + i)).toLocaleString(locale, { weekday: "short", timeZone: "UTC" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onYearChange(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-sm font-medium tabular-nums">{year}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onYearChange(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("graphs.year.total").replace("{n}", String(totalYear))}
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-1 min-w-max">
          <div className="flex gap-[3px] pl-6">
            {weeks.map((_, col) => {
              const lbl = monthLabels.find((m) => m.col === col);
              return (
                <div key={col} className="w-[11px] text-[10px] text-muted-foreground capitalize shrink-0">
                  {lbl?.label ?? ""}
                </div>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            <div className="flex flex-col gap-[3px] pr-1">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="h-[11px] w-5 text-[9px] leading-[11px] text-muted-foreground text-right capitalize">
                  {i % 2 === 1 ? weekdayLabel(i) : ""}
                </div>
              ))}
            </div>
            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col gap-[3px]">
                {week.map((d) =>
                  d.inYear ? (
                    <div
                      key={d.isoDate}
                      title={`${d.isoDate} — ${t("graphs.year.tooltipCount").replace("{n}", String(d.count))}`}
                      className="h-[11px] w-[11px] rounded-[2px] border border-border/60"
                      style={{ backgroundColor: heatmapCellColor(d.count, maxCount) }}
                    />
                  ) : (
                    <div key={d.isoDate} className="h-[11px] w-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{t("graphs.legend.less")}</span>
        {HEATMAP_LEVEL_ALPHA.map((alpha, i) => (
          <div
            key={i}
            className="h-[11px] w-[11px] rounded-[2px] border border-border/60"
            style={{ backgroundColor: i === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${alpha})` }}
          />
        ))}
        <span>{t("graphs.legend.more")}</span>
      </div>
    </div>
  );
}
