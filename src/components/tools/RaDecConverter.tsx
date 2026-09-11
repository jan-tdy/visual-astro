import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { parseSexagesimal, formatDecimalDegrees } from "@/lib/astro";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RaDecConverter() {
  const { t } = useI18n();
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");
  const [copied, setCopied] = useState(false);

  const raDeg = parseSexagesimal(ra, true);
  const decDeg = parseSexagesimal(dec, false);

  const formatted =
    raDeg !== null && decDeg !== null
      ? `RA ${formatDecimalDegrees(raDeg)}°, Dec ${formatDecimalDegrees(decDeg)}°`
      : null;

  const handleCopy = async () => {
    if (!formatted) return;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.radec.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.radec.ra")}</Label>
            <Input
              className="w-full h-9"
              value={ra}
              onChange={(e) => setRa(e.target.value)}
              placeholder={t("tools.radec.raPh")}
            />
            <p className="text-xs text-muted-foreground">{t("tools.radec.raHint")}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatDecimalDegrees(raDeg)}°
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.radec.dec")}</Label>
            <Input
              className="w-full h-9"
              value={dec}
              onChange={(e) => setDec(e.target.value)}
              placeholder={t("tools.radec.decPh")}
            />
            <p className="text-xs text-muted-foreground">{t("tools.radec.decHint")}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatDecimalDegrees(decDeg)}°
          </p>
        </div>

        {formatted && (
          <div className="sm:col-span-2 flex items-center gap-2 pt-2 border-t">
            <span className="font-medium text-sm">{t("tools.radec.combined")}:</span>
            <code className="text-sm tabular-nums flex-1">{formatted}</code>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="h-8 w-8 p-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
