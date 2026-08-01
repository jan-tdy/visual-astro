import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadText } from "@/lib/exporters";
import { usePrefs } from "@/hooks/usePrefs";
import { useI18n } from "@/hooks/useI18n";
import { JdConverter } from "@/components/tools/JdConverter";
import { parseSIPS, buildVSNETFromSIPS, buildAAVSOFromSIPS } from "@/lib/sips";

export default function Tools() {
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [starCode, setStarCode] = useState("");
  const [aavsoCode, setAavsoCode] = useState("");
  const [obsCode, setObsCode] = useState("");
  const [chartId, setChartId] = useState("");

  const parsed = useMemo(
    () =>
      parseSIPS(input, {
        minCols: (n) => t("tools.error.minCols").replace("{line}", String(n)),
        nonNumeric: (n) => t("tools.error.nonNumeric").replace("{line}", String(n)),
      }),
    [input, t],
  );

  const handleFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setInput(text);
  };

  const openPortal = (kind: "vsnet" | "aavso") => {
    if (!prefs.openPortalAfterExport[kind]) return;
    const url = prefs.portalUrls[kind];
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const dlVSNET = () => {
    if (!starCode.trim() || !obsCode.trim()) return;
    if (parsed.rows.length === 0) return;
    const text = buildVSNETFromSIPS(parsed.rows, starCode, obsCode, parsed.filter);
    const name = `${(starCode || "vsnet").trim()}.txt`;
    downloadText(name, text);
    openPortal("vsnet");
  };

  const dlAAVSO = () => {
    if (!aavsoCode.trim() || !obsCode.trim()) return;
    if (parsed.rows.length === 0) return;
    const text = buildAAVSOFromSIPS(parsed.rows, aavsoCode, obsCode, parsed.filter, chartId);
    const name = `${(aavsoCode || "aavso").trim()}_aavso.txt`;
    downloadText(name, text);
    openPortal("aavso");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-1">{t("tools.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("tools.subtitle")}</p>

        <div className="mb-6">
          <JdConverter />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("tools.converter.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("tools.converter.desc")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="star">{t("tools.starVSNET")}</Label>
                <Input id="star" value={starCode} onChange={(e) => setStarCode(e.target.value)} placeholder={t("tools.starVSNET.ph")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aavso">{t("tools.starAAVSO")}</Label>
                <Input id="aavso" value={aavsoCode} onChange={(e) => setAavsoCode(e.target.value)} placeholder={t("tools.starAAVSO.ph")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="obs">{t("tools.obs")}</Label>
                <Input id="obs" value={obsCode} onChange={(e) => setObsCode(e.target.value)} placeholder={t("tools.obs.ph")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chart">{t("tools.chart")}</Label>
                <Input id="chart" value={chartId} onChange={(e) => setChartId(e.target.value)} placeholder={t("tools.chart.ph")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="file">{t("tools.file")}</Label>
              <Input
                id="file"
                type="file"
                accept=".dat,.txt,text/plain"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="input">{t("tools.paste")}</Label>
              <Textarea
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                placeholder={"# VAR Name: DO Dra\n# Filter: LPR\n2461204.398287 2.4923 0.0256"}
                className="font-mono text-xs"
              />
            </div>

            {(parsed.varName || parsed.filter || parsed.rows.length > 0) && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {parsed.varName && <div>{t("tools.parsed.star")}: <span className="font-mono">{parsed.varName}</span></div>}
                {parsed.filter && <div>{t("tools.parsed.filter")}: <span className="font-mono">{parsed.filter}</span> → {t("tools.parsed.aavso")}: <span className="font-mono">{aavsoFilter(parsed.filter)}</span></div>}
                <div>{t("tools.parsed.count")}: <span className="font-mono">{parsed.rows.length}</span></div>
              </div>
            )}

            {parsed.errors.length > 0 && (
              <div className="text-xs text-destructive space-y-0.5">
                {parsed.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
                {parsed.errors.length > 10 && (
                  <div>{t("tools.errors.more").replace("{n}", String(parsed.errors.length - 10))}</div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={dlVSNET}
                disabled={parsed.rows.length === 0 || !starCode.trim() || !obsCode.trim()}
              >
                {t("tools.download.vsnet")}
              </Button>
              <Button
                variant="outline"
                onClick={dlAAVSO}
                disabled={parsed.rows.length === 0 || !aavsoCode.trim() || !obsCode.trim()}
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
      </main>
    </div>
  );
}