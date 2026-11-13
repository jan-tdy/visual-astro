import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadText } from "@/lib/exporters";
import { openPortalWithFallback } from "@/lib/popup";
import { usePrefs } from "@/hooks/usePrefs";
import { useI18n } from "@/hooks/useI18n";
import { parseSIPS, buildVSNETFromSIPS, buildAAVSOFromSIPS } from "@/lib/sips";
import { ChartLookupWarning, useCatalogAutoFill } from "@/lib/tools/catalogLookup";

export function Ascii3Converter() {
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const [ascii3Input, setAscii3Input] = useState("");
  const [ascii3StarCode, setAscii3StarCode] = useState("");
  const [ascii3AavsoCode, setAscii3AavsoCode] = useState("");
  const [ascii3ObsCode, setAscii3ObsCode] = useState("");
  const [ascii3ChartId, setAscii3ChartId] = useState("");
  const [ascii3Filter, setAscii3Filter] = useState("");

  const ascii3ChartStatus = useCatalogAutoFill(ascii3AavsoCode, "chart_id", ascii3ChartId, setAscii3ChartId);

  const ascii3Parsed = useMemo(
    () =>
      parseSIPS(ascii3Input, {
        minCols: (n) => t("tools.error.minCols", { line: n }),
        nonNumeric: (n) => t("tools.error.nonNumeric", { line: n }),
      }),
    [ascii3Input, t],
  );

  const handleAscii3File = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setAscii3Input(text);
  };

  const openPortal = (kind: "vsnet" | "aavso") => {
    if (!prefs.openPortalAfterExport[kind]) return;
    const url = prefs.portalUrls[kind];
    if (url) {
      openPortalWithFallback(url, {
        blocked: t("editor.popupBlocked"),
        hint: t("editor.popupBlockedHint"),
        open: t("editor.popupBlockedOpen"),
      });
    }
  };

  const dlAscii3ToAavso = () => {
    if (!ascii3AavsoCode.trim() || !ascii3ObsCode.trim()) return;
    if (ascii3Parsed.rows.length === 0) return;
    const text = buildAAVSOFromSIPS(ascii3Parsed.rows, ascii3AavsoCode, ascii3ObsCode, ascii3Filter || null, ascii3ChartId);
    const name = `${(ascii3AavsoCode || "aavso").trim()}_aavso.txt`;
    downloadText(name, text);
    openPortal("aavso");
  };

  const dlAscii3ToVsnet = () => {
    if (!ascii3StarCode.trim() || !ascii3ObsCode.trim()) return;
    if (ascii3Parsed.rows.length === 0) return;
    const text = buildVSNETFromSIPS(ascii3Parsed.rows, ascii3StarCode, ascii3ObsCode, ascii3Filter || null);
    const name = `${(ascii3StarCode || "vsnet").trim()}.txt`;
    downloadText(name, text);
    openPortal("vsnet");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.ascii3.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.ascii3.desc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ascii3-star">{t("tools.starVSNET")}</Label>
            <Input id="ascii3-star" value={ascii3StarCode} onChange={(e) => setAscii3StarCode(e.target.value)} placeholder={t("tools.starVSNET.ph")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ascii3-aavso">{t("tools.starAAVSO")}</Label>
            <Input id="ascii3-aavso" value={ascii3AavsoCode} onChange={(e) => setAscii3AavsoCode(e.target.value)} placeholder={t("tools.starAAVSO.ph")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ascii3-obs">{t("tools.obs")}</Label>
            <Input id="ascii3-obs" value={ascii3ObsCode} onChange={(e) => setAscii3ObsCode(e.target.value)} placeholder={t("tools.obs.ph")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ascii3-filter">{t("tools.filter")}</Label>
            <Input id="ascii3-filter" value={ascii3Filter} onChange={(e) => setAscii3Filter(e.target.value)} placeholder={t("tools.filter.ph")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ascii3-chart">{t("tools.chart")}</Label>
            <Input id="ascii3-chart" value={ascii3ChartId} onChange={(e) => setAscii3ChartId(e.target.value)} placeholder={t("tools.chart.ph")} />
            <p className="text-xs text-muted-foreground">{t("tools.chart.hint")}</p>
            <ChartLookupWarning chartId={ascii3ChartId} status={ascii3ChartStatus} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="ascii3-file">{t("tools.ascii3.file")}</Label>
          <Input
            id="ascii3-file"
            type="file"
            accept=".dat,.txt,text/plain"
            onChange={(e) => handleAscii3File(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="ascii3-input">{t("tools.paste")}</Label>
          <Textarea
            id="ascii3-input"
            value={ascii3Input}
            onChange={(e) => setAscii3Input(e.target.value)}
            rows={6}
            placeholder={"2461204.398287 2.4923 0.0256"}
            className="font-mono text-xs"
          />
        </div>

        {ascii3Parsed.rows.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>{t("tools.parsed.count")}: <span className="font-mono">{ascii3Parsed.rows.length}</span></div>
          </div>
        )}

        {ascii3Parsed.errors.length > 0 && (
          <div className="text-xs text-destructive space-y-0.5">
            {ascii3Parsed.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
            {ascii3Parsed.errors.length > 10 && (
              <div>{t("tools.errors.more", { n: ascii3Parsed.errors.length - 10 })}</div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={dlAscii3ToVsnet}
            disabled={ascii3Parsed.rows.length === 0 || !ascii3StarCode.trim() || !ascii3ObsCode.trim()}
          >
            {t("tools.download.vsnet")}
          </Button>
          <Button
            variant="outline"
            onClick={dlAscii3ToAavso}
            disabled={ascii3Parsed.rows.length === 0 || !ascii3AavsoCode.trim() || !ascii3ObsCode.trim()}
          >
            {t("tools.download.aavso")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("tools.portal.info")}{" "}
          <span className="font-medium">{t("tools.portal.settings")}</span>.
        </p>
      </CardContent>
    </Card>
  );
}
