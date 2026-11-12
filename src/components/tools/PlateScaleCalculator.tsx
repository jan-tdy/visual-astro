import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { computePlateScale, formatArcminAsDM } from "@/lib/scopeTools";

export function PlateScaleCalculator() {
  const { t } = useI18n();
  const [focalLength, setFocalLength] = useState("1000");
  const [pixelSize, setPixelSize] = useState("3.76");
  const [resX, setResX] = useState("4144");
  const [resY, setResY] = useState("2822");

  const result = computePlateScale(Number(focalLength), Number(pixelSize), Number(resX), Number(resY));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.plateScale.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.plateScale.desc")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.fov.focalLength")}</Label>
            <Input className="h-9" value={focalLength} onChange={(e) => setFocalLength(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.plateScale.pixelSize")}</Label>
            <Input className="h-9" value={pixelSize} onChange={(e) => setPixelSize(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.plateScale.resX")}</Label>
            <Input className="h-9" value={resX} onChange={(e) => setResX(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.plateScale.resY")}</Label>
            <Input className="h-9" value={resY} onChange={(e) => setResY(e.target.value)} />
          </div>
        </div>

        {result ? (
          <div className="text-xs space-y-0.5 pt-2 border-t">
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.plateScale.result.scale")}</span><span className="font-mono">{result.arcsecPerPixel.toFixed(2)}″/px</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.plateScale.result.sensor")}</span><span className="font-mono">{result.sensorWidthMm.toFixed(2)} × {result.sensorHeightMm.toFixed(2)} mm</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.plateScale.result.fov")}</span><span className="font-mono">{formatArcminAsDM(result.fovWidthArcmin)} × {formatArcminAsDM(result.fovHeightArcmin)}</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("tools.plateScale.result.sampling")}</span><span className="font-mono">{t(`tools.plateScale.sampling.${result.samplingKey}`)}</span></div>
          </div>
        ) : (
          <p className="text-xs text-destructive">{t("tools.etc.error.invalidInput")}</p>
        )}

        <p className="text-xs text-muted-foreground">{t("tools.plateScale.note")}</p>
      </CardContent>
    </Card>
  );
}
