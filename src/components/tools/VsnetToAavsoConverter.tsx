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
import { parseVSNET, buildAAVSOFromVSNET } from "@/lib/sips";
import { ChartLookupWarning, useCatalogAutoFill } from "@/lib/tools/catalogLookup";

export function VsnetToAavsoConverter() {
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const [vsnetInput, setVsnetInput] = useState("");
  const [vsnetChartId, setVsnetChartId] = useState("");

  const vsnetParsed = useMemo(
    () => parseVSNET(vsnetInput, { badLine: (n) => t("tools.vsnet.error.badLine", { line: n }) }),
    [vsnetInput, t],
  );
  const vsnetStarCode = vsnetParsed.rows[0]?.starCode ?? "";
  const vsnetObsCode = vsnetParsed.rows[0]?.obsCode ?? "";

  const vsnetChartStatus = useCatalogAutoFill(vsnetStarCode, "chart_id", vsnetChartId, setVsnetChartId);

  const handleVsnetFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setVsnetInput(text);
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

  const dlVsnetToAavso = () => {
    if (!vsnetStarCode.trim() || !vsnetObsCode.trim()) return;
    if (vsnetParsed.rows.length === 0) return;
    const text = buildAAVSOFromVSNET(vsnetParsed.rows, vsnetStarCode, vsnetObsCode, vsnetChartId);
    const name = `${(vsnetStarCode || "aavso").trim()}_aavso.txt`;
    downloadText(name, text);
    openPortal("aavso");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.vsnet.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.vsnet.desc")}</p>

        <div className="space-y-1">
          <Label htmlFor="vsnet-chart">{t("tools.chart")}</Label>
          <Input id="vsnet-chart" value={vsnetChartId} onChange={(e) => setVsnetChartId(e.target.value)} placeholder={t("tools.chart.ph")} />
          <p className="text-xs text-muted-foreground">{t("tools.chart.hint")}</p>
          <ChartLookupWarning chartId={vsnetChartId} status={vsnetChartStatus} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="vsnet-file">{t("tools.vsnet.file")}</Label>
          <Input
            id="vsnet-file"
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => handleVsnetFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="vsnet-input">{t("tools.paste")}</Label>
          <Textarea
            id="vsnet-input"
            value={vsnetInput}
            onChange={(e) => setVsnetInput(e.target.value)}
            rows={6}
            placeholder={"DRADO    2461204.398   9.8234 DPV V"}
            className="font-mono text-xs"
          />
        </div>

        {(vsnetStarCode || vsnetObsCode || vsnetParsed.rows.length > 0) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {vsnetStarCode && <div>{t("tools.aavso.parsed.star")}: <span className="font-mono">{vsnetStarCode}</span></div>}
            {vsnetObsCode && <div>{t("tools.aavso.parsed.obs")}: <span className="font-mono">{vsnetObsCode}</span></div>}
            <div>{t("tools.parsed.count")}: <span className="font-mono">{vsnetParsed.rows.length}</span></div>
          </div>
        )}

        {vsnetParsed.errors.length > 0 && (
          <div className="text-xs text-destructive space-y-0.5">
            {vsnetParsed.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
            {vsnetParsed.errors.length > 10 && (
              <div>{t("tools.errors.more", { n: vsnetParsed.errors.length - 10 })}</div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={dlVsnetToAavso}
            disabled={vsnetParsed.rows.length === 0 || !vsnetStarCode.trim() || !vsnetObsCode.trim()}
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
