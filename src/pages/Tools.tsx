import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadText } from "@/lib/exporters";
import { openPortalWithFallback } from "@/lib/popup";
import { usePrefs } from "@/hooks/usePrefs";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/integrations/supabase/client";
import { JdConverter } from "@/components/tools/JdConverter";
import {
  parseSIPS,
  buildVSNETFromSIPS,
  buildAAVSOFromSIPS,
  aavsoFilter,
  parseVSNET,
  buildAAVSOFromVSNET,
} from "@/lib/sips";

/** Look up a star's chart_id in the catalog by AAVSO code, VSNET code, or name (case-insensitive). */
async function fetchCatalogChartId(code: string): Promise<string | null> {
  if (/[,()]/.test(code)) return null; // would break the .or() filter syntax below
  const { data } = await supabase
    .from("stars")
    .select("chart_id")
    .or(`aavso_code.ilike.${code},vsnet_code.ilike.${code},name.ilike.${code}`)
    .limit(1)
    .maybeSingle();
  return data?.chart_id?.trim() || null;
}

/**
 * Debounced auto-fill of a chart-id field from the star catalog, keyed off the AAVSO
 * code field. Only touches the field while it still holds our own previous auto-fill —
 * once the observer edits it by hand, further catalog lookups leave it alone.
 */
function useCatalogChartId(code: string, chartId: string, setChartId: (v: string) => void) {
  const chartIdRef = useRef(chartId);
  const autoFilledRef = useRef("");
  chartIdRef.current = chartId;

  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const handle = setTimeout(async () => {
      const current = chartIdRef.current.trim();
      if (current && current !== autoFilledRef.current) return;
      const found = await fetchCatalogChartId(trimmed);
      autoFilledRef.current = found ?? "";
      if (found || current) setChartId(found ?? "");
    }, 400);
    return () => clearTimeout(handle);
  }, [code, setChartId]);
}

export default function Tools() {
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [starCode, setStarCode] = useState("");
  const [aavsoCode, setAavsoCode] = useState("");
  const [obsCode, setObsCode] = useState("");
  const [chartId, setChartId] = useState("");

  const [vsnetInput, setVsnetInput] = useState("");
  const [vsnetAavsoCode, setVsnetAavsoCode] = useState("");
  const [vsnetObsCode, setVsnetObsCode] = useState("");
  const [vsnetChartId, setVsnetChartId] = useState("");

  const [ascii3Input, setAscii3Input] = useState("");
  const [ascii3AavsoCode, setAscii3AavsoCode] = useState("");
  const [ascii3ObsCode, setAscii3ObsCode] = useState("");
  const [ascii3ChartId, setAscii3ChartId] = useState("");
  const [ascii3Filter, setAscii3Filter] = useState("");

  useCatalogChartId(aavsoCode, chartId, setChartId);
  useCatalogChartId(vsnetAavsoCode, vsnetChartId, setVsnetChartId);
  useCatalogChartId(ascii3AavsoCode, ascii3ChartId, setAscii3ChartId);

  const parsed = useMemo(
    () =>
      parseSIPS(input, {
        minCols: (n) => t("tools.error.minCols").replace("{line}", String(n)),
        nonNumeric: (n) => t("tools.error.nonNumeric").replace("{line}", String(n)),
      }),
    [input, t],
  );

  const vsnetParsed = useMemo(
    () => parseVSNET(vsnetInput, { badLine: (n) => t("tools.vsnet.error.badLine").replace("{line}", String(n)) }),
    [vsnetInput, t],
  );

  const ascii3Parsed = useMemo(
    () =>
      parseSIPS(ascii3Input, {
        minCols: (n) => t("tools.error.minCols").replace("{line}", String(n)),
        nonNumeric: (n) => t("tools.error.nonNumeric").replace("{line}", String(n)),
      }),
    [ascii3Input, t],
  );

  const handleFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setInput(text);
  };

  const handleVsnetFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setVsnetInput(text);
  };

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

  const dlVsnetToAavso = () => {
    if (!vsnetAavsoCode.trim() || !vsnetObsCode.trim()) return;
    if (vsnetParsed.rows.length === 0) return;
    const text = buildAAVSOFromVSNET(vsnetParsed.rows, vsnetAavsoCode, vsnetObsCode, vsnetChartId);
    const name = `${(vsnetAavsoCode || "aavso").trim()}_aavso.txt`;
    downloadText(name, text);
    openPortal("aavso");
  };

  const dlAscii3ToAavso = () => {
    if (!ascii3AavsoCode.trim() || !ascii3ObsCode.trim()) return;
    if (ascii3Parsed.rows.length === 0) return;
    const text = buildAAVSOFromSIPS(ascii3Parsed.rows, ascii3AavsoCode, ascii3ObsCode, ascii3Filter || null, ascii3ChartId);
    const name = `${(ascii3AavsoCode || "aavso").trim()}_aavso.txt`;
    downloadText(name, text);
    openPortal("aavso");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-1">{t("tools.title")} — Visual Astro</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("tools.subtitle")}</p>

        <div className="columns-1 lg:columns-2 xl:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <div>
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
                <p className="text-xs text-muted-foreground">{t("tools.chart.hint")}</p>
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
                  <div>{t("tools.errors.more", { n: parsed.errors.length - 10 })}</div>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("tools.vsnet.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("tools.vsnet.desc")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="vsnet-aavso">{t("tools.starAAVSO")}</Label>
                <Input id="vsnet-aavso" value={vsnetAavsoCode} onChange={(e) => setVsnetAavsoCode(e.target.value)} placeholder={t("tools.starAAVSO.ph")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vsnet-obs">{t("tools.obs")}</Label>
                <Input id="vsnet-obs" value={vsnetObsCode} onChange={(e) => setVsnetObsCode(e.target.value)} placeholder={t("tools.obs.ph")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vsnet-chart">{t("tools.chart")}</Label>
                <Input id="vsnet-chart" value={vsnetChartId} onChange={(e) => setVsnetChartId(e.target.value)} placeholder={t("tools.chart.ph")} />
                <p className="text-xs text-muted-foreground">{t("tools.chart.hint")}</p>
              </div>
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

            {vsnetParsed.rows.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
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
                disabled={vsnetParsed.rows.length === 0 || !vsnetAavsoCode.trim() || !vsnetObsCode.trim()}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("tools.ascii3.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("tools.ascii3.desc")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>
      </main>
    </div>
  );
}