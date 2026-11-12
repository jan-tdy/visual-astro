import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { compareMagnitudes, magnitudeDiffFromFluxRatio } from "@/lib/scopeTools";

export function MagnitudeFluxConverter() {
  const { t } = useI18n();
  const [magA, setMagA] = useState("5.0");
  const [magB, setMagB] = useState("6.0");
  const [ratio, setRatio] = useState("2.512");

  const a = Number(magA);
  const b = Number(magB);
  const cmp = Number.isFinite(a) && Number.isFinite(b) ? compareMagnitudes(a, b) : null;

  const r = Number(ratio);
  const dm = magnitudeDiffFromFluxRatio(r);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.magnitude.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.magnitude.desc")}</p>

        <div className="space-y-2">
          <h3 className="font-medium text-sm">{t("tools.magnitude.fromMags")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("tools.magnitude.magA")}</Label>
              <Input className="h-9" value={magA} onChange={(e) => setMagA(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("tools.magnitude.magB")}</Label>
              <Input className="h-9" value={magB} onChange={(e) => setMagB(e.target.value)} />
            </div>
          </div>
          {cmp && (
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.magnitude.diff")}</span><span className="font-mono">{cmp.diff.toFixed(4)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.magnitude.ratioAB")}</span><span className="font-mono">{cmp.fluxRatioAB.toFixed(6)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.magnitude.ratioBA")}</span><span className="font-mono">{cmp.fluxRatioBA.toFixed(6)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.magnitude.brighter")}</span><span className="font-mono">{cmp.brighter === "equal" ? t("tools.magnitude.brighter.equal") : cmp.brighter}</span></div>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <h3 className="font-medium text-sm">{t("tools.magnitude.fromRatio")}</h3>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.magnitude.ratioIn")}</Label>
            <Input className="h-9" value={ratio} onChange={(e) => setRatio(e.target.value)} />
          </div>
          <p className="text-2xl font-semibold tabular-nums">{dm !== null ? dm.toFixed(4) : "—"}</p>
        </div>

        <p className="text-xs text-muted-foreground">{t("tools.magnitude.note")}</p>
      </CardContent>
    </Card>
  );
}
