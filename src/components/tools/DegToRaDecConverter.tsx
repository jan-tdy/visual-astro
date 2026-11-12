import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { formatSexagesimal } from "@/lib/astro";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

function parseDecimalDegrees(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const v = parseFloat(trimmed);
  return Number.isFinite(v) ? v : null;
}

export function DegToRaDecConverter() {
  const { t } = useI18n();
  const [raDeg, setRaDeg] = useState("");
  const [decDeg, setDecDeg] = useState("");
  const [copied, setCopied] = useState(false);

  const raVal = parseDecimalDegrees(raDeg);
  const decVal = parseDecimalDegrees(decDeg);

  const raOut = raVal !== null ? formatSexagesimal(raVal, true) : "—";
  const decOut = decVal !== null ? formatSexagesimal(decVal, false) : "—";
  const formatted = raVal !== null && decVal !== null ? `RA ${raOut}, Dec ${decOut}` : null;

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
        <CardTitle className="text-lg">{t("tools.deg2radec.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.deg2radec.ra")}</Label>
            <Input
              className="w-full h-9"
              value={raDeg}
              onChange={(e) => setRaDeg(e.target.value)}
              placeholder={t("tools.deg2radec.raPh")}
            />
            <p className="text-xs text-muted-foreground">{t("tools.deg2radec.raHint")}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{raOut}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.deg2radec.dec")}</Label>
            <Input
              className="w-full h-9"
              value={decDeg}
              onChange={(e) => setDecDeg(e.target.value)}
              placeholder={t("tools.deg2radec.decPh")}
            />
            <p className="text-xs text-muted-foreground">{t("tools.deg2radec.decHint")}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{decOut}</p>
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
