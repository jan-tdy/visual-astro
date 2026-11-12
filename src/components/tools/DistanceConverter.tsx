import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import { DISTANCE_UNITS, convertDistance, type DistanceUnit } from "@/lib/scopeTools";

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 0.0001 || abs >= 1e9)) return n.toExponential(4);
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function DistanceConverter() {
  const { t } = useI18n();
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState<DistanceUnit>("au");

  const numeric = Number(value);
  const converted = Number.isFinite(numeric) ? convertDistance(numeric, unit) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.distances.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.distances.desc")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.distances.value")}</Label>
            <Input className="h-9" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.distances.unit")}</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as DistanceUnit)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISTANCE_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{t(`tools.distances.unit.${u}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {converted && (
          <div className="text-xs space-y-0.5 pt-2 border-t">
            {DISTANCE_UNITS.filter((u) => u !== unit).map((u) => (
              <div key={u} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t(`tools.distances.unit.${u}`)}</span>
                <span className="font-mono">{formatNumber(converted[u])}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("tools.distances.note")}</p>
      </CardContent>
    </Card>
  );
}
