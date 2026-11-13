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
import { parseAAVSO, buildVSNETFromAAVSO, buildThreeColFromAAVSO } from "@/lib/sips";
import { StarLookupWarning, useCatalogAutoFill } from "@/lib/tools/catalogLookup";

export function AavsoToVsnetConverter() {
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const [aavsoInput, setAavsoInput] = useState("");
  const [aavsoVsnetCode, setAavsoVsnetCode] = useState("");

  const aavsoParsed = useMemo(
    () => parseAAVSO(aavsoInput, { badLine: (n) => t("tools.aavso.error.badLine", { line: n }) }),
    [aavsoInput, t],
  );
  const aavsoStarCode = aavsoParsed.rows[0]?.starCode ?? "";
  const aavsoObsCode = aavsoParsed.obsCode ?? "";
  // A single VSNET star code gets applied to every row on export, so a file mixing
  // observations of more than one star would silently mislabel everything but the
  // first star. Detect that and block the download rather than exporting bad data.
  const aavsoHasMixedStars = useMemo(
    () => new Set(aavsoParsed.rows.map((r) => r.starCode)).size > 1,
    [aavsoParsed],
  );
  const aavsoVsnetStatus = useCatalogAutoFill(aavsoStarCode, "vsnet_code", aavsoVsnetCode, setAavsoVsnetCode);

  const handleAavsoFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setAavsoInput(text);
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

  const dlAavsoToVsnet = () => {
    if (!aavsoVsnetCode.trim() || !aavsoObsCode.trim()) return;
    if (aavsoParsed.rows.length === 0 || aavsoHasMixedStars) return;
    const text = buildVSNETFromAAVSO(aavsoParsed.rows, aavsoVsnetCode, aavsoObsCode);
    const name = `${(aavsoVsnetCode || "vsnet").trim()}.txt`;
    downloadText(name, text);
    openPortal("vsnet");
  };

  const dlAavsoToThreeCol = () => {
    if (aavsoParsed.rows.length === 0) return;
    const text = buildThreeColFromAAVSO(aavsoParsed.rows);
    const name = `${(aavsoStarCode || "ascii3").trim()}.dat`;
    downloadText(name, text);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.aavso.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.aavso.desc")}</p>

        <div className="space-y-1">
          <Label htmlFor="aavso-file">{t("tools.aavso.file")}</Label>
          <Input
            id="aavso-file"
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => handleAavsoFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="aavso-input">{t("tools.paste")}</Label>
          <Textarea
            id="aavso-input"
            value={aavsoInput}
            onChange={(e) => setAavsoInput(e.target.value)}
            rows={6}
            placeholder={"#TYPE=Extended\n#OBSCODE=DPV\n#SOFTWARE=Visual-Astro (japysoft)\n#DELIM=,\n#DATE=JD\n#OBSTYPE=CCD\nDODRA,2461204.398287,9.8234,0.0256,V,NO,STD,ENSEMBLE,na,na,na,na,na,na,na"}
            className="font-mono text-xs"
          />
        </div>

        {(aavsoStarCode || aavsoObsCode || aavsoParsed.rows.length > 0) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {aavsoStarCode && <div>{t("tools.aavso.parsed.star")}: <span className="font-mono">{aavsoStarCode}</span></div>}
            {aavsoObsCode && <div>{t("tools.aavso.parsed.obs")}: <span className="font-mono">{aavsoObsCode}</span></div>}
            <div>{t("tools.parsed.count")}: <span className="font-mono">{aavsoParsed.rows.length}</span></div>
          </div>
        )}

        {aavsoParsed.errors.length > 0 && (
          <div className="text-xs text-destructive space-y-0.5">
            {aavsoParsed.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
            {aavsoParsed.errors.length > 10 && (
              <div>{t("tools.errors.more", { n: aavsoParsed.errors.length - 10 })}</div>
            )}
          </div>
        )}

        {aavsoHasMixedStars && (
          <p className="text-xs text-destructive font-semibold">{t("tools.aavso.error.mixedStars")}</p>
        )}

        <div className="space-y-1">
          <Label htmlFor="aavso-vsnet-code">{t("tools.starVSNET")}</Label>
          <Input
            id="aavso-vsnet-code"
            value={aavsoVsnetCode}
            onChange={(e) => setAavsoVsnetCode(e.target.value)}
            placeholder={t("tools.starVSNET.ph")}
          />
          <StarLookupWarning status={aavsoVsnetStatus} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={dlAavsoToVsnet}
            disabled={aavsoParsed.rows.length === 0 || !aavsoVsnetCode.trim() || !aavsoObsCode.trim() || aavsoHasMixedStars}
          >
            {t("tools.download.vsnet")}
          </Button>
          <Button
            variant="outline"
            onClick={dlAavsoToThreeCol}
            disabled={aavsoParsed.rows.length === 0}
          >
            {t("tools.download.ascii3")}
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
