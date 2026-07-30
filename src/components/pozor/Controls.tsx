import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { POZOR_LOCATIONS } from "@/lib/pozor";
import type { CcdTarget, PozorSettings } from "./shared";

export function LocationPicker({
  settings,
  setSettings,
}: {
  settings: PozorSettings;
  setSettings: (s: PozorSettings) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{t("pozor.location")}</Label>
        <Select
          value={settings.locationKey}
          onValueChange={(v) => setSettings({ ...settings, locationKey: v })}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POZOR_LOCATIONS.map((l) => (
              <SelectItem key={l.key} value={l.key}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("pozor.minAlt")}</Label>
        <Input
          type="number"
          className="w-[110px] h-9"
          value={settings.minAltitude}
          min={0}
          max={89}
          onChange={(e) =>
            setSettings({ ...settings, minAltitude: Math.max(0, Math.min(89, Number(e.target.value) || 0)) })
          }
        />
      </div>
    </div>
  );
}

export function TargetPicker({
  targets,
  value,
  onChange,
  label,
}: {
  targets: CcdTarget[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = targets.find((x) => x.id === value);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label ?? t("pozor.target")}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-[220px] h-9 justify-between font-normal">
            {selected ? selected.name : t("pozor.pickTarget")}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("pozor.search")} />
            <CommandList>
              <CommandEmpty>{t("pozor.noTargets")}</CommandEmpty>
              <CommandGroup>
                {targets.map((x) => (
                  <CommandItem
                    key={x.id}
                    value={`${x.name} ${x.constellation}`}
                    onSelect={() => {
                      onChange(x.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === x.id ? "opacity-100" : "opacity-0")} />
                    <span className="font-medium">{x.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{x.constellation}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MultiTargetPicker({
  targets,
  values,
  onToggle,
}: {
  targets: CcdTarget[];
  values: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{t("pozor.targets")}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-[220px] h-9 justify-between font-normal">
            {values.length ? t("pozor.selectedN").replace("{n}", String(values.length)) : t("pozor.pickTarget")}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("pozor.search")} />
            <CommandList>
              <CommandEmpty>{t("pozor.noTargets")}</CommandEmpty>
              <CommandGroup>
                {targets.map((x) => (
                  <CommandItem key={x.id} value={`${x.name} ${x.constellation}`} onSelect={() => onToggle(x.id)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", values.includes(x.id) ? "opacity-100" : "opacity-0")}
                    />
                    <span className="font-medium">{x.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{x.constellation}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="date" className="w-[160px] h-9" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}