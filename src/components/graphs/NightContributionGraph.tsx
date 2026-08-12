import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { HEATMAP_LEVEL_ALPHA, heatmapCellColor } from "./contributionColor";

export interface NightOption {
  id: string;
  date: string; // YYYY-MM-DD, the session's anchor date
  count: number;
}

// Hour-of-night axis anchored at noon UT so a single observing night (which
// crosses midnight) renders as one contiguous run of cells: 12,13,…23,00,…11.
const HOUR_ORDER = Array.from({ length: 24 }, (_, i) => (i + 12) % 24);

export function NightContributionGraph({
  nights,
  selectedNightId,
  onSelectNight,
  hourCounts,
  untimedCount,
}: {
  nights: NightOption[];
  selectedNightId: string;
  onSelectNight: (id: string) => void;
  hourCounts: number[];
  untimedCount: number;
}) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const index = nights.findIndex((n) => n.id === selectedNightId);
  const selected = index >= 0 ? nights[index] : null;

  const maxCount = useMemo(() => Math.max(0, ...hourCounts), [hourCounts]);
  const total = useMemo(() => hourCounts.reduce((s, v) => s + v, 0), [hourCounts]);

  if (nights.length === 0) {
    return <p className="text-sm text-muted-foreground p-6 text-center">{t("graphs.night.empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => index > 0 && onSelectNight(nights[index - 1].id)}
              disabled={index <= 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => index >= 0 && index < nights.length - 1 && onSelectNight(nights[index + 1].id)}
              disabled={index < 0 || index >= nights.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-52 justify-between">
                {selected ? `${selected.date} · ${selected.count}×` : t("graphs.night.pick")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder={t("graphs.night.search")} />
                <CommandList>
                  <CommandEmpty>{t("graphs.night.none")}</CommandEmpty>
                  <CommandGroup>
                    {[...nights].reverse().map((n) => (
                      <CommandItem
                        key={n.id}
                        value={n.date}
                        onSelect={() => {
                          onSelectNight(n.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedNightId === n.id ? "opacity-100" : "opacity-0")} />
                        {n.date} · {n.count}×
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-xs text-muted-foreground">{t("graphs.night.total").replace("{n}", String(total))}</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1 min-w-max">
          {HOUR_ORDER.map((hour, i) => {
            const count = hourCounts[i] ?? 0;
            return (
              <div key={hour} className="flex flex-col items-center gap-1">
                <div
                  title={t("graphs.night.tooltipHour").replace("{hour}", String(hour).padStart(2, "0")).replace("{n}", String(count))}
                  className="h-5 w-5 rounded-[3px] border border-border/60"
                  style={{ backgroundColor: heatmapCellColor(count, maxCount) }}
                />
                <span className="text-[9px] text-muted-foreground tabular-nums">{String(hour).padStart(2, "0")}</span>
              </div>
            );
          })}
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
