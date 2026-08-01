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

/** Convert Julian Date to UTC Date (Meeus). */
function jdToDate(jd: number): Date {
  const J = jd + 0.5;
  const Z = Math.floor(J);
  const F = J - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayF = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayF);
  const dayFrac = dayF - day;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const totalSec = Math.round(dayFrac * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return new Date(Date.UTC(year, month - 1, day, h, m, s));
}

function vsnetDateFromJD(jd: number): string {
  const d = jdToDate(jd);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = d.getUTCDate();
  const frac =
    (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
  const dayWithFrac = (day + frac).toFixed(3).padStart(6, "0");
  return `${y}${mo}${dayWithFrac}`;
}

interface SipsRow { jd: number; mag: number; err: number }
interface SipsParsed {
  rows: SipsRow[];
  varName: string | null;
  filter: string | null;
  errors: string[];
}

function parseSIPS(
  text: string,
  msgs: { minCols: (line: number) => string; nonNumeric: (line: number) => string },
): SipsParsed {
  const rows: SipsRow[] = [];
  const errors: string[] = [];
  let varName: string | null = null;
  let filter: string | null = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#")) {
      const mVar = line.match(/VAR\s*Name\s*:\s*(.+?)\s*$/i);
      if (mVar) varName = mVar[1].trim();
      const mFil = line.match(/Filter\s*:\s*([^\s]+)/i);
      if (mFil) filter = mFil[1].trim();
      return;
    }
    const parts = line.split(/[\s,;]+/);
    if (parts.length < 2) { errors.push(msgs.minCols(i + 1)); return; }
    const jd = parseFloat(parts[0]);
    const mag = parseFloat(parts[1]);
    const err = parts.length >= 3 ? parseFloat(parts[2]) : NaN;
    if (!Number.isFinite(jd) || !Number.isFinite(mag)) {
      errors.push(msgs.nonNumeric(i + 1));
      return;
    }
    rows.push({ jd, mag, err: Number.isFinite(err) ? err : 0 });
  });
  return { rows, varName, filter, errors };
}

/**
 * VSNET CCD line format used by AAVSO/VSNET tools:
 *   CODE      yyyymmdd.ddd  mag  observer  filter
 * JD is converted to fractional UT date; filter is appended at the end.
 */
function vsnetFilter(f: string | null): string {
  if (!f) return "C"; // unfiltered / clear
  const key = f.toUpperCase();
  // Map common SIPS filter labels to VSNET conventions
  const map: Record<string, string> = {
    V: "V", B: "B", R: "R", I: "I", U: "U",
    TR: "TR", TG: "TG", TB: "TB",
    CV: "CV", CR: "CR", CBB: "CBB",
    LPR: "CV", CLEAR: "C", CLR: "C", NONE: "C",
  };
  return map[key] ?? key;
}

function buildVSNETFromSIPS(
  rows: SipsRow[],
  starCode: string,
  obsCode: string,
  filter: string | null,
): string {
  const code = starCode.trim().padEnd(8, " ");
  const obs = obsCode.trim();
  const filt = vsnetFilter(filter);
  const out: string[] = [];
  for (const r of rows) {
    const dateStr = vsnetDateFromJD(r.jd);
    const magStr = r.mag.toFixed(4).padStart(7, " ");
    out.push(`${code} ${dateStr} ${magStr} ${obs} ${filt}`);
  }
  return out.join("\n") + (out.length ? "\n" : "");
}

const AAVSO_FILTER_MAP: Record<string, string> = {
  V: "V", B: "B", R: "R", I: "I", U: "U",
  TR: "TR", TG: "TG", TB: "TB",
  CV: "CV", CR: "CR", CBB: "CBB",
  LPR: "CV", // Luminance / clear with IR-cut → AAVSO „Clear (V-band reduced)"
  CLEAR: "CV", CLR: "CV", NONE: "CV",
};

function aavsoFilter(f: string | null): string {
  if (!f) return "CV";
  const key = f.toUpperCase();
  return AAVSO_FILTER_MAP[key] ?? key;
}

function buildAAVSOFromSIPS(
  rows: SipsRow[],
  aavsoCode: string,
  obsCode: string,
  filter: string | null,
  chartId: string,
): string {
  const header = [
    "#TYPE=Extended",
    `#OBSCODE=${obsCode.trim()}`,
    "#SOFTWARE=Visual-Astro (japysoft)",
    "#DELIM=,",
    "#DATE=JD",
    "#OBSTYPE=CCD",
  ].join("\n");
  const filt = aavsoFilter(filter);
  const chart = chartId.trim() || "na";
  const body: string[] = [];
  for (const r of rows) {
    body.push([
      aavsoCode.trim(),
      r.jd.toFixed(6),
      r.mag.toFixed(4),
      r.err > 0 ? r.err.toFixed(4) : "na",
      filt,
      "NO",      // TRANSFORMED
      "STD",     // MTYPE
      "ENSEMBLE", "na", "na", "na",
      "na",      // AIRMASS
      "na",      // GROUP
      chart,
      "na",      // NOTES
    ].join(","));
  }
  return header + "\n" + body.join("\n") + "\n";
}

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