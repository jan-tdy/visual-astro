import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { pickDeterministic } from "@/lib/horoscope";

const COLLIMATION = [
  "is perfectly aligned. Enjoy it — it will not last.",
  "is subtly, infuriatingly, off by one turn of the screw.",
  "has opinions about being adjusted today. Best not to.",
  "will hold collimation for exactly as long as you don't need it to.",
];
const FOCUS = [
  "Focus will drift the instant the target gets interesting.",
  "The focuser will feel suspiciously smooth today. Don't trust it.",
  "Temperature focus-shift is in your future, whether you like it or not.",
  "You will nail focus on the first try and immediately bump the tube.",
];
const LUCK = [
  "A satellite will cross your best sub. It always does.",
  "The one cloud in the sky will find your target specifically.",
  "Tonight's seeing will be excellent — for your neighbour, two streets over.",
  "Everything will work. This will make you deeply suspicious.",
  "The battery will die at 87% through the sequence, on principle.",
  "You will finally remember to remove the lens cap before slewing.",
];
const ADVICE = [
  "Bring a jacket you don't think you'll need.",
  "Double-check the dew heater is actually plugged in.",
  'Do not, under any circumstances, "just quickly" update the firmware tonight.',
  "Whatever you forgot, it's the USB hub.",
  "Trust the polar alignment. Do not trust it enough to skip checking it.",
];

export function TelescopeHoroscope() {
  const { t } = useI18n();
  const [name, setName] = useState("Big Blue");
  const [revealed, setRevealed] = useState(0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const effectiveName = name.trim() || t("tools.horoscope.defaultName");
  const seed = `${effectiveName}:${today}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.horoscope.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("tools.fun.badge")}</p>
        <p className="text-sm text-muted-foreground">{t("tools.horoscope.desc")}</p>
        <div className="space-y-1">
          <Label className="text-xs">{t("tools.horoscope.scopeName")}</Label>
          <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tools.horoscope.scopeName.ph")} />
        </div>
        <Button onClick={() => setRevealed((n) => n + 1)}>{t("tools.horoscope.generate")}</Button>
        {revealed > 0 && (
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <p><strong>{effectiveName}</strong> {"—"} {today}</p>
            <p><strong>{t("tools.horoscope.collimation")}:</strong> {pickDeterministic(COLLIMATION, seed, "collimation")}</p>
            <p><strong>{t("tools.horoscope.focus")}:</strong> {pickDeterministic(FOCUS, seed, "focus")}</p>
            <p><strong>{t("tools.horoscope.fortune")}:</strong> {pickDeterministic(LUCK, seed, "luck")}</p>
            <p><strong>{t("tools.horoscope.advice")}:</strong> {pickDeterministic(ADVICE, seed, "advice")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
