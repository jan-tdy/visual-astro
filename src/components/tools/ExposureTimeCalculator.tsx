import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import {
  BROADBAND_FILTERS,
  NARROWBAND_FILTERS,
  POINT_FILTERS,
  computeExposure,
  angularToLinearSize,
  linearToAngularSize,
  type EtcMode,
  type EtcResult,
} from "@/lib/etc";
import { DISTANCE_UNITS, convertDistance, type DistanceUnit } from "@/lib/scopeTools";

function parseOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const v = parseFloat(trimmed);
  return Number.isFinite(v) ? v : null;
}

/** Format an arcsecond value as arcsec, arcmin or degrees, whichever reads best. */
function formatAngularSize(arcsec: number): string {
  if (!Number.isFinite(arcsec)) return "—";
  const abs = Math.abs(arcsec);
  if (abs >= 3600) return `${(arcsec / 3600).toFixed(4)}°`;
  if (abs >= 60) return `${(arcsec / 60).toFixed(3)}′`;
  return `${arcsec.toFixed(3)}″`;
}

function formatLinearSize(km: number): string {
  if (!Number.isFinite(km)) return "—";
  const abs = Math.abs(km);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e9)) return `${km.toExponential(4)} km`;
  return `${km.toLocaleString("en-US", { maximumFractionDigits: 3 })} km`;
}

/** A compact "label on top, input below" field, matching the other Tools cards. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function ExposureTimeCalculator() {
  const { t } = useI18n();
  const [mode, setMode] = useState<EtcMode>("point");

  const [diameter, setDiameter] = useState("0.18");
  const [throughput, setThroughput] = useState("0.5");
  const [pixScale, setPixScale] = useState("0.86");
  const [readNoise, setReadNoise] = useState("1.5");
  const [dark, setDark] = useState("0.0014");
  const [seeing, setSeeing] = useState("2");
  const [aperture, setAperture] = useState("");
  const [expTime, setExpTime] = useState("600");
  const [nExp, setNExp] = useState("600");
  const [skyMag, setSkyMag] = useState("21.5");
  const [airmass, setAirmass] = useState("1.0");

  const [magnitude, setMagnitude] = useState("18.0");
  const [pointFilter, setPointFilter] = useState("V");

  const [surfaceMag, setSurfaceMag] = useState("23.0");
  const [broadbandFilter, setBroadbandFilter] = useState("L");

  const [lineFlux, setLineFlux] = useState("4e-17");
  const [narrowFilter, setNarrowFilter] = useState("Ha");
  const [bwOverride, setBwOverride] = useState("");

  const [sizeDistance, setSizeDistance] = useState("1");
  const [sizeDistanceUnit, setSizeDistanceUnit] = useState<DistanceUnit>("au");
  const [angularSizeIn, setAngularSizeIn] = useState("1");
  const [linearSizeIn, setLinearSizeIn] = useState("1000");

  const sizeDistanceKm = useMemo(() => {
    const v = parseOrNull(sizeDistance);
    if (v === null) return null;
    return convertDistance(v, sizeDistanceUnit).km;
  }, [sizeDistance, sizeDistanceUnit]);

  const linearFromAngular = useMemo(() => {
    const angle = parseOrNull(angularSizeIn);
    if (angle === null || sizeDistanceKm === null) return null;
    return angularToLinearSize(sizeDistanceKm, angle);
  }, [angularSizeIn, sizeDistanceKm]);

  const angularFromLinear = useMemo(() => {
    const size = parseOrNull(linearSizeIn);
    if (size === null || sizeDistanceKm === null || sizeDistanceKm <= 0) return null;
    return linearToAngularSize(sizeDistanceKm, size);
  }, [linearSizeIn, sizeDistanceKm]);

  const { result, error } = useMemo((): { result: EtcResult | null; error: string | null } => {
    const common = {
      diameterM: parseOrNull(diameter) ?? NaN,
      throughput: parseOrNull(throughput) ?? NaN,
      pixScaleArcsecPerPix: parseOrNull(pixScale) ?? NaN,
      readNoiseE: parseOrNull(readNoise) ?? NaN,
      darkCurrentEPerPixPerSec: parseOrNull(dark) ?? NaN,
      seeingArcsec: parseOrNull(seeing) ?? NaN,
      apertureRadiusArcsec: parseOrNull(aperture),
      expTimeSec: parseOrNull(expTime) ?? NaN,
      nExp: parseOrNull(nExp) ?? 1,
      skyMagPerArcsec2: parseOrNull(skyMag) ?? NaN,
      airmass: parseOrNull(airmass) ?? 1,
    };
    if (Object.values(common).some((v) => typeof v === "number" && !Number.isFinite(v))) {
      return { result: null, error: t("tools.etc.error.invalidInput") };
    }

    try {
      if (mode === "point") {
        const mag = parseOrNull(magnitude);
        if (mag === null) return { result: null, error: t("tools.etc.error.invalidInput") };
        return { result: computeExposure(common, { mode, magnitude: mag, filter: pointFilter }), error: null };
      }
      if (mode === "broadband") {
        const surf = parseOrNull(surfaceMag);
        if (surf === null) return { result: null, error: t("tools.etc.error.invalidInput") };
        return {
          result: computeExposure(common, { mode, surfaceMagPerArcsec2: surf, filter: broadbandFilter }),
          error: null,
        };
      }
      const flux = parseOrNull(lineFlux);
      if (flux === null) return { result: null, error: t("tools.etc.error.invalidInput") };
      return {
        result: computeExposure(common, {
          mode,
          lineFluxErgCm2SArcsec2: flux,
          filter: narrowFilter,
          bandwidthOverrideNm: parseOrNull(bwOverride),
        }),
        error: null,
      };
    } catch {
      return { result: null, error: t("tools.etc.error.unknownFilter") };
    }
  }, [
    mode, diameter, throughput, pixScale, readNoise, dark, seeing, aperture, expTime, nExp, skyMag, airmass,
    magnitude, pointFilter, surfaceMag, broadbandFilter, lineFlux, narrowFilter, bwOverride, t,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.etc.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.etc.desc")}</p>

        <div className="space-y-1">
          <Label className="text-xs">{t("tools.etc.mode")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as EtcMode)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="point">{t("tools.etc.mode.point")}</SelectItem>
              <SelectItem value="broadband">{t("tools.etc.mode.broadband")}</SelectItem>
              <SelectItem value="narrow">{t("tools.etc.mode.narrow")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label={t("tools.etc.diameter")}>
            <Input className="h-9" value={diameter} onChange={(e) => setDiameter(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.throughput")}>
            <Input className="h-9" value={throughput} onChange={(e) => setThroughput(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.pixScale")}>
            <Input className="h-9" value={pixScale} onChange={(e) => setPixScale(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.readNoise")}>
            <Input className="h-9" value={readNoise} onChange={(e) => setReadNoise(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.dark")}>
            <Input className="h-9" value={dark} onChange={(e) => setDark(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.seeing")}>
            <Input className="h-9" value={seeing} onChange={(e) => setSeeing(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.aperture")}>
            <Input className="h-9" value={aperture} onChange={(e) => setAperture(e.target.value)} placeholder={t("tools.etc.aperture.ph")} />
          </Field>
          <Field label={t("tools.etc.expTime")}>
            <Input className="h-9" value={expTime} onChange={(e) => setExpTime(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.nExp")}>
            <Input className="h-9" value={nExp} onChange={(e) => setNExp(e.target.value)} />
          </Field>
          <Field label={t("tools.etc.skyMag")}>
            <Input className="h-9" value={skyMag} onChange={(e) => setSkyMag(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("tools.etc.skyMag.hint")}</p>
          </Field>
          <Field label={t("tools.etc.airmass")}>
            <Input className="h-9" value={airmass} onChange={(e) => setAirmass(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t">
          {mode === "point" && (
            <>
              <Field label={t("tools.etc.magnitude")}>
                <Input className="h-9" value={magnitude} onChange={(e) => setMagnitude(e.target.value)} />
              </Field>
              <Field label={t("tools.filter")}>
                <Select value={pointFilter} onValueChange={setPointFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(POINT_FILTERS).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          {mode === "broadband" && (
            <>
              <Field label={t("tools.etc.surfaceMag")}>
                <Input className="h-9" value={surfaceMag} onChange={(e) => setSurfaceMag(e.target.value)} />
              </Field>
              <Field label={t("tools.filter")}>
                <Select value={broadbandFilter} onValueChange={setBroadbandFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(BROADBAND_FILTERS).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          {mode === "narrow" && (
            <>
              <Field label={t("tools.etc.lineFlux")}>
                <Input className="h-9" value={lineFlux} onChange={(e) => setLineFlux(e.target.value)} />
              </Field>
              <Field label={t("tools.filter")}>
                <Select value={narrowFilter} onValueChange={setNarrowFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(NARROWBAND_FILTERS).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("tools.etc.bwOverride")}>
                <Input className="h-9" value={bwOverride} onChange={(e) => setBwOverride(e.target.value)} placeholder={t("tools.etc.bwOverride.ph")} />
              </Field>
            </>
          )}
        </div>

        {error && <p className="text-xs text-destructive font-semibold">{error}</p>}

        {result && (
          <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("tools.etc.result.aperture")}</span>
              <span className="font-mono">{result.apertureRadiusArcsec.toFixed(2)}″ ({result.apertureAreaArcsec2.toFixed(2)} ″²)</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("tools.etc.result.snrFrame")}</span>
              <span className="font-mono tabular-nums">{result.snrPerFrame.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 border-t pt-1">
              <span className="font-medium">{t("tools.etc.result.snrStacked")}</span>
              <span className="font-mono font-semibold tabular-nums text-base">{result.snrStacked.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("tools.etc.result.snrSbFrame")}</span>
              <span className="font-mono tabular-nums">{result.snrPerArcsec2PerFrame.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("tools.etc.result.snrSbStacked")}</span>
              <span className="font-mono tabular-nums">{result.snrPerArcsec2Stacked.toFixed(3)}</span>
            </div>
            <details className="pt-1">
              <summary className="cursor-pointer text-muted-foreground">{t("tools.etc.result.details")}</summary>
              <div className="mt-1 space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("tools.etc.result.sourceE")}</span>
                  <span className="font-mono">{result.sourceElectronsPerFrame.toExponential(3)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("tools.etc.result.skyE")}</span>
                  <span className="font-mono">{result.skyElectronsPerFrame.toExponential(3)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("tools.etc.result.darkE")}</span>
                  <span className="font-mono">{result.darkElectronsPerFrame.toExponential(3)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("tools.etc.result.rnVar")}</span>
                  <span className="font-mono">{result.readNoiseVariancePerFrame.toExponential(3)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("tools.etc.result.noise")}</span>
                  <span className="font-mono">{result.noisePerFrame.toExponential(3)}</span>
                </div>
              </div>
            </details>
          </div>
        )}

        <div className="space-y-3 pt-2 border-t">
          <div>
            <h3 className="font-medium text-sm">{t("tools.etc.sizeAngle.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("tools.etc.sizeAngle.desc")}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("tools.distances.value")}>
              <Input className="h-9" value={sizeDistance} onChange={(e) => setSizeDistance(e.target.value)} />
            </Field>
            <Field label={t("tools.distances.unit")}>
              <Select value={sizeDistanceUnit} onValueChange={(v) => setSizeDistanceUnit(v as DistanceUnit)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISTANCE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{t(`tools.distances.unit.${u}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Field label={t("tools.etc.sizeAngle.angularIn")}>
                <Input className="h-9" value={angularSizeIn} onChange={(e) => setAngularSizeIn(e.target.value)} />
              </Field>
              <p className="text-xs text-muted-foreground">
                {t("tools.etc.sizeAngle.linearOut")}: <span className="font-mono">{linearFromAngular !== null ? formatLinearSize(linearFromAngular) : "—"}</span>
              </p>
            </div>
            <div className="space-y-1">
              <Field label={t("tools.etc.sizeAngle.linearIn")}>
                <Input className="h-9" value={linearSizeIn} onChange={(e) => setLinearSizeIn(e.target.value)} />
              </Field>
              <p className="text-xs text-muted-foreground">
                {t("tools.etc.sizeAngle.angularOut")}: <span className="font-mono">{angularFromLinear !== null ? formatAngularSize(angularFromLinear) : "—"}</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t("tools.etc.sizeAngle.note")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
