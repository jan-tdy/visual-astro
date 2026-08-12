import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { HEATMAP_LEVEL_ALPHA, heatmapCellColor } from "./contributionColor";

export interface NightColumn {
  id: string;
  date: string; // YYYY-MM-DD, the session's anchor date
  hours: number[]; // 24 UT-hour buckets, indexed like HOUR_ORDER below
}

// Hour-of-night axis anchored at noon UT so a single observing night (which
// crosses midnight) stays chronological: 12,13,…23,00,…11. Index i holds hour
// HOUR_ORDER[i], i.e. i=0 is 12:00 and i=23 is 11:00 the following day.
const HOUR_ORDER = Array.from({ length: 24 }, (_, i) => (i + 12) % 24);
// Rows are drawn top-to-bottom in the DOM, but the axis should read bottom-up
// (earlier at the bottom, later at the top) — so render HOUR_ORDER reversed.
const ROWS = [...HOUR_ORDER].reverse();

function hourIndex(hour: number): number {
  return (hour - 12 + 24) % 24;
}

export function NightContributionGraph({
  nights,
  untimedCount,
}: {
  nights: NightColumn[];
  untimedCount: number;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "sk" ? "sk-SK" : "en-US";

  const maxCount = useMemo(() => {
    let m = 0;
    nights.forEach((n) => n.hours.forEach((c) => { if (c > m) m = c; }));
    return m;
  }, [nights]);

  const total = useMemo(
    () => nights.reduce((s, n) => s + n.hours.reduce((a, b) => a + b, 0), 0),
    [nights]
  );

  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let last = "";
    nights.forEach((n, col) => {
      const d = new Date(`${n.date}T00:00:00Z`);
      if (isNaN(d.getTime())) return;
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (key !== last) {
        labels.push({ col, label: d.toLocaleString(locale, { month: "short", year: "2-digit", timeZone: "UTC" }) });
        last = key;
      }
    });
    return labels;
  }, [nights, locale]);

  if (nights.length === 0) {
    return <p className="text-sm text-muted-foreground p-6 text-center">{t("graphs.night.empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-medium">{t("graphs.night.nights").replace("{n}", String(nights.length))}</span>
        <span className="text-xs text-muted-foreground">{t("graphs.night.total").replace("{n}", String(total))}</span>
      </div>

      <div className="flex gap-1">
        <div className="flex flex-col gap-[2px] pt-[15px] shrink-0">
          {ROWS.map((hour) => (
            <div key={hour} className="h-[10px] w-8 text-[9px] leading-[10px] text-muted-foreground text-right tabular-nums">
              {String(hour).padStart(2, "0")}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex flex-col gap-1">
            <div className="flex gap-[2px]">
              {nights.map((n, col) => {
                const lbl = monthLabels.find((m) => m.col === col);
                return (
                  <div key={n.id} className="w-[10px] text-[9px] text-muted-foreground capitalize shrink-0 whitespace-nowrap">
                    {lbl?.label ?? ""}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[2px]">
              {nights.map((n) => (
                <div key={n.id} className="flex flex-col gap-[2px]">
                  {ROWS.map((hour) => {
                    const count = n.hours[hourIndex(hour)] ?? 0;
                    return (
                      <div
                        key={hour}
                        title={t("graphs.night.tooltipCell")
                          .replace("{date}", n.date)
                          .replace("{hour}", String(hour).padStart(2, "0"))
                          .replace("{n}", String(count))}
                        className="h-[10px] w-[10px] rounded-[2px] border border-border/60"
                        style={{ backgroundColor: heatmapCellColor(count, maxCount) }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
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

      {untimedCount > 0 && (
        <p className="text-xs text-muted-foreground">{t("graphs.night.untimed").replace("{n}", String(untimedCount))}</p>
      )}
    </div>
  );
}
