import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

const SUBJECTS = [
  "A rogue cirrus layer",
  "The neighbour's new security floodlight",
  "An unforecast temperature inversion",
  "Saharan dust nobody mentioned",
  "A satellite train, several of them, all at once",
  "The seeing",
  "A sudden and deeply personal dew problem",
  "The one cloud in the entire county",
  "Jupiter, out of spite",
  "The mount's firmware",
  "A passing weather balloon",
  "Airglow, apparently",
];
const ACTIONS = [
  "parked itself directly over the target",
  "ruined the transparency for exactly forty minutes",
  "triggered the guider into a full existential crisis",
  "fogged the corrector plate on principle",
  "arrived the moment the exposure started",
  "convinced the ASCOM driver to disconnect",
  "made the limiting magnitude embarrassing",
  "turned a 3-hour session into a 12-minute one",
  "was somehow visible only through the eyepiece, never the forecast",
  "gave the FWHM a personality disorder",
];
const CLOSERS = [
  'Session logged as a partial loss.',
  "Recommend blaming Mercury retrograde in the notes.",
  "No usable data; morale also affected.",
  'Filed under "clear skies, allegedly".',
  "The forecast app has been quietly muted.",
  "This has been reported to nobody, because nobody would believe it.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function CloudyNightExcuseGenerator() {
  const { t } = useI18n();
  const [excuse, setExcuse] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.excuse.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("tools.fun.badge")}</p>
        <p className="text-sm text-muted-foreground">{t("tools.excuse.desc")}</p>
        <Button onClick={() => setExcuse(`${pick(SUBJECTS)} ${pick(ACTIONS)}. ${pick(CLOSERS)}`)}>
          {t("tools.excuse.generate")}
        </Button>
        <div className="rounded-md bg-muted/50 p-3 text-sm min-h-[3rem] flex items-center">
          {excuse ?? t("tools.excuse.placeholder")}
        </div>
      </CardContent>
    </Card>
  );
}
