import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";

const PREFIXES = ["JS", "HD", "NGC", "PSR", "WD", "USL", "KOI", "TIC", "OGLE", "GJ"];
const GREEK = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Omega"];
const SUFFIXES = ["b", "c", "Prime", "Minor", "A", "B", "Redux"];
const EPITHETS = [
  "the Unremarkable",
  "That Definitely Wasn't a Plane",
  "Probably a Satellite",
  "the Slightly Fuzzy",
  "of Uncertain Magnitude",
  "the Overexposed",
  "Last Seen Tuesday",
  "the Suspiciously Round",
];
const FALLBACK_NAMES = ["Cygni", "Draconis", "Lyrae", "Andromedae", "Orionis"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function StarNamer() {
  const { t } = useI18n();
  const [thing, setThing] = useState("");
  const [result, setResult] = useState<{ catalogue: string; common: string } | null>(null);

  const generate = () => {
    const catalogue = `${pick(PREFIXES)}-${randInt(1000, 99999)}${pick(SUFFIXES)}`;
    const common = `${pick(GREEK)} ${thing.trim() || pick(FALLBACK_NAMES)} ${pick(EPITHETS)}`;
    setResult({ catalogue, common });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.starNamer.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("tools.fun.badge")}</p>
        <p className="text-sm text-muted-foreground">{t("tools.starNamer.desc")}</p>
        <div className="space-y-1">
          <Label className="text-xs">{t("tools.starNamer.thing")}</Label>
          <Input className="h-9" value={thing} onChange={(e) => setThing(e.target.value)} placeholder={t("tools.starNamer.thing.ph")} />
        </div>
        <Button onClick={generate}>{t("tools.starNamer.generate")}</Button>
        <div className="rounded-md bg-muted/50 p-3 text-sm min-h-[3.5rem]">
          {result ? (
            <>
              <strong>{result.catalogue}</strong>
              <br />
              {t("tools.starNamer.informally")}: {result.common}
            </>
          ) : (
            t("tools.starNamer.placeholder")
          )}
        </div>
      </CardContent>
    </Card>
  );
}
