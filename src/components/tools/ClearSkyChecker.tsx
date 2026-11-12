import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

interface GeoMatch {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface ForecastRow {
  time: Date;
  cloudCover: number;
}

function cloudLabelKey(pct: number): string {
  if (pct < 20) return "tools.skyCheck.clear";
  if (pct < 50) return "tools.skyCheck.partlyCloudy";
  if (pct < 80) return "tools.skyCheck.mostlyCloudy";
  return "tools.skyCheck.overcast";
}

export function ClearSkyChecker() {
  const { t } = useI18n();
  const [place, setPlace] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [matches, setMatches] = useState<GeoMatch[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [rows, setRows] = useState<ForecastRow[]>([]);

  const loadForecast = async (latV: number, lonV: number) => {
    if (Number.isNaN(latV) || Number.isNaN(lonV)) { setError(t("tools.skyCheck.error.notNumbers")); return; }
    if (latV < -90 || latV > 90) { setError(t("tools.skyCheck.error.latRange")); return; }
    if (lonV < -180 || lonV > 180) { setError(t("tools.skyCheck.error.lonRange")); return; }
    setError("");
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latV}&longitude=${lonV}&hourly=cloudcover&forecast_days=2&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) {
        setRows([]);
        setError(data.reason || t("tools.skyCheck.error.forecastRejected"));
        return;
      }
      const now = new Date();
      const times: string[] = data.hourly.time;
      const clouds: number[] = data.hourly.cloudcover;
      const parsed = times
        .map((tStr, i) => ({ time: new Date(tStr), cloudCover: clouds[i] }))
        .filter((r) => r.time >= now)
        .slice(0, 24);
      setTimezone(data.timezone || "");
      setRows(parsed);
    } catch {
      setRows([]);
      setError(t("tools.skyCheck.error.unreachableForecast"));
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    const query = place.trim();
    if (!query) return;
    setError("");
    setMatches([]);
    setLoading(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.reason || t("tools.skyCheck.error.geocodeRejected")); return; }
      const results: GeoMatch[] = data.results || [];
      if (results.length === 0) { setError(t("tools.skyCheck.error.noMatches")); return; }
      setMatches(results);
    } catch {
      setError(t("tools.skyCheck.error.unreachableGeocode"));
    } finally {
      setLoading(false);
    }
  };

  const pickMatch = (m: GeoMatch) => {
    setLat(String(m.latitude));
    setLon(String(m.longitude));
    setMatches([]);
    void loadForecast(m.latitude, m.longitude);
  };

  const fetchClick = () => {
    if (!lat.trim() || !lon.trim()) { setError(t("tools.skyCheck.error.needLocation")); return; }
    void loadForecast(Number(lat), Number(lon));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.skyCheck.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.skyCheck.desc")}</p>

        <div className="space-y-1">
          <Label className="text-xs">{t("tools.skyCheck.location")}</Label>
          <div className="flex gap-2">
            <Input
              className="h-9"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={t("tools.skyCheck.location.ph")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
            />
            <Button variant="outline" size="sm" onClick={() => void search()} disabled={loading}>
              {t("tools.skyCheck.search")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.skyCheck.lat")}</Label>
            <Input className="h-9" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="37.88" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.skyCheck.lon")}</Label>
            <Input className="h-9" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-4.78" />
          </div>
        </div>
        <Button size="sm" onClick={fetchClick} disabled={loading}>{t("tools.skyCheck.getForecast")}</Button>

        {matches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {matches.map((m, i) => (
              <Button key={i} variant="outline" size="sm" onClick={() => pickMatch(m)}>
                {m.name}{m.admin1 ? `, ${m.admin1}` : ""}, {m.country}
              </Button>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {rows.length > 0 && (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">{t("tools.skyCheck.timezone")}: {timezone}</p>
            <div className="max-h-56 overflow-y-auto border rounded-md">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="text-left px-2 py-1">{t("tools.skyCheck.col.time")}</th>
                    <th className="text-left px-2 py-1">{t("tools.skyCheck.col.cloud")}</th>
                    <th className="text-left px-2 py-1">{t("tools.skyCheck.col.conditions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 font-mono">
                        {r.time.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-2 py-1 font-mono">{r.cloudCover}%</td>
                      <td className="px-2 py-1">{t(cloudLabelKey(r.cloudCover))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("tools.skyCheck.note")}</p>
      </CardContent>
    </Card>
  );
}
