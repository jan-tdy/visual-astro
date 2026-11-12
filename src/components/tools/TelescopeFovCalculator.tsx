import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { computeEyepieceFov } from "@/lib/scopeTools";

export function TelescopeFovCalculator() {
  const { t } = useI18n();
  const [aperture, setAperture] = useState("200");
  const [focalLength, setFocalLength] = useState("1000");
  const [eyepieceFl, setEyepieceFl] = useState("10");
  const [apparentFov, setApparentFov] = useState("50");

  const result = computeEyepieceFov(Number(aperture), Number(focalLength), Number(eyepieceFl), Number(apparentFov));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.fov.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.fov.desc")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.fov.aperture")}</Label>
            <Input className="h-9" value={aperture} onChange={(e) => setAperture(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.fov.focalLength")}</Label>
            <Input className="h-9" value={focalLength} onChange={(e) => setFocalLength(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.fov.eyepieceFl")}</Label>
            <Input className="h-9" value={eyepieceFl} onChange={(e) => setEyepieceFl(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.fov.apparentFov")}</Label>
            <Input className="h-9" value={apparentFov} onChange={(e) => setApparentFov(e.target.value)} />
          </div>
        </div>

        {result ? (
          <div className="text-xs space-y-0.5 pt-2 border-t">
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.fov.result.fRatio")}</span><span className="font-mono">f/{result.fRatio.toFixed(1)}</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.fov.result.magnification")}</span><span className="font-mono">{result.magnification.toFixed(1)}×</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.fov.result.trueFov")}</span><span className="font-mono">{result.trueFovDeg.toFixed(2)}° ({result.trueFovArcmin.toFixed(1)}′)</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.fov.result.exitPupil")}</span><span className="font-mono">{result.exitPupilMm.toFixed(2)} mm</span></div>
          </div>
        ) : (
          <p className="text-xs text-destructive">{t("tools.etc.error.invalidInput")}</p>
        )}

        <p className="text-xs text-muted-foreground">{t("tools.fov.note")}</p>
      </CardContent>
    </Card>
  );
}
