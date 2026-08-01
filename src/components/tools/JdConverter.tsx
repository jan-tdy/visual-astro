import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/hooks/useI18n";
import { dateToJD, jdToDate, parseUtHours, utcDate } from "@/lib/pozor";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JdConverter() {
  const { t } = useI18n();
  const [date, setDate] = useState(todayIso());
  const [ut, setUt] = useState("00:00:00");
  const [jd, setJd] = useState("");

  const hours = parseUtHours(ut) ?? 0;
  const computedJd = dateToJD(utcDate(date, hours));
  const parsedJd = Number(jd);
  const back = Number.isFinite(parsedJd) && jd.trim() ? jdToDate(parsedJd) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.jd.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-medium text-sm">{t("pozor.jd.toJd")}</h3>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("pozor.date")}</Label>
              <Input type="date" className="w-[160px] h-9" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("pozor.utTime")}</Label>
              <Input className="w-[130px] h-9" value={ut} onChange={(e) => setUt(e.target.value)} />
            </div>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{computedJd.toFixed(5)}</p>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium text-sm">{t("pozor.jd.toDate")}</h3>
          <div className="space-y-1">
            <Label className="text-xs">JD</Label>
            <Input
              className="w-[200px] h-9"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="2461252.41667"
            />
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {back ? `${back.toISOString().slice(0, 10)} ${back.toISOString().slice(11, 19)} UT` : "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
