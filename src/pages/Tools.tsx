import { useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadText } from "@/lib/exporters";
import { useI18n } from "@/hooks/useI18n";

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

function convertTabVtoVSNET(
  text: string,
  starCode: string,
  obsCode: string,
  msgs: { minCols: (line: number) => string; nonNumeric: (line: number) => string },
): { out: string; count: number; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  const code = starCode.trim().padEnd(8, " ");
  const obs = obsCode.trim();
  const out: string[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) return;
    const parts = line.split(/[\s,;]+/);
    if (parts.length < 2) {
      errors.push(msgs.minCols(i + 1));
      return;
    }
    const jd = parseFloat(parts[0]);
    const mag = parseFloat(parts[1]);
    if (!Number.isFinite(jd) || !Number.isFinite(mag)) {
      errors.push(msgs.nonNumeric(i + 1));
      return;
    }
    const dateStr = vsnetDateFromJD(jd);
    const magStr = mag.toFixed(4).padStart(7, " ");
    out.push(`${code} ${dateStr} ${magStr} ${obs}`);
  });
  return { out: out.join("\n") + (out.length ? "\n" : ""), count: out.length, errors };
}

export default function Tools() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [starCode, setStarCode] = useState("");
  const [obsCode, setObsCode] = useState("");
  const [output, setOutput] = useState("");
  const [info, setInfo] = useState<string>("");
  const [errs, setErrs] = useState<string[]>([]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setInput(text);
  };

  const run = () => {
    if (!starCode.trim() || !obsCode.trim()) {
      setInfo(t("tools.error.missingCodes"));
      setOutput("");
      setErrs([]);
      return;
    }
    const r = convertTabVtoVSNET(input, starCode, obsCode, {
      minCols: (line) => t("tools.error.minCols").replace("{line}", String(line)),
      nonNumeric: (line) => t("tools.error.nonNumeric").replace("{line}", String(line)),
    });
    setOutput(r.out);
    setErrs(r.errors);
    setInfo(t("tools.info.converted").replace("{count}", String(r.count)));
  };

  const dl = () => {
    if (!output) return;
    downloadText(`${(starCode || "vsnet").trim()}.txt`, output);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-1">{t("tools.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("tools.subtitle")}</p>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("tools.converter.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("tools.converter.inputDesc")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="star">{t("tools.starCode")}</Label>
                <Input id="star" value={starCode} onChange={(e) => setStarCode(e.target.value)} placeholder={t("tools.starCode.placeholder")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="obs">{t("tools.obsCode")}</Label>
                <Input id="obs" value={obsCode} onChange={(e) => setObsCode(e.target.value)} placeholder={t("tools.obsCode.placeholder")} />
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
              <Label htmlFor="input">{t("tools.pasteInstead")}</Label>
              <Textarea
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                placeholder="2461204.40138  2.4968  0.0064"
                className="font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={run}>{t("tools.convert")}</Button>
              <Button variant="outline" onClick={dl} disabled={!output}>{t("tools.download")}</Button>
            </div>

            {info && <p className="text-sm text-muted-foreground">{info}</p>}
            {errs.length > 0 && (
              <div className="text-xs text-destructive space-y-0.5">
                {errs.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
                {errs.length > 10 && <div>{t("tools.error.andMore").replace("{count}", String(errs.length - 10))}</div>}
              </div>
            )}

            {output && (
              <div className="space-y-1">
                <Label>{t("tools.output")}</Label>
                <Textarea readOnly value={output} rows={8} className="font-mono text-xs" />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}