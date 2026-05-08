import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Sparkles, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [obsCode, setObsCode] = useState("DPV");
  const [refDate, setRefDate] = useState("1980-01-01");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{
    bytes: number;
    counts: { stars: number; sessions: number; observations: number; promOverrides: number };
    loading: boolean;
  }>({ bytes: 0, counts: { stars: 0, sessions: 0, observations: 0, promOverrides: 0 }, loading: false });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("obs_code,fecha_referencia")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setObsCode(data.obs_code);
          setRefDate(data.fecha_referencia);
        }
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ obs_code: obsCode, fecha_referencia: refDate })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Uložené");
  };

  const computeUsage = async () => {
    if (!user) return;
    setUsage((u) => ({ ...u, loading: true }));
    const [stars, sessions, observations, profile] = await Promise.all([
      supabase.from("stars").select("*").eq("user_id", user.id),
      supabase.from("sessions").select("*").eq("user_id", user.id),
      supabase.from("observations").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("user_id", user.id),
    ]);
    const enc = new TextEncoder();
    const sz = (x: any) => enc.encode(JSON.stringify(x ?? [])).length;
    let promBytes = 0;
    try {
      const raw = localStorage.getItem("prom_overrides_v1");
      if (raw) promBytes = enc.encode(raw).length;
    } catch {}
    const promCount = (() => {
      try {
        const raw = localStorage.getItem("prom_overrides_v1");
        return raw ? Object.keys(JSON.parse(raw)).length : 0;
      } catch { return 0; }
    })();
    const bytes = sz(stars.data) + sz(sessions.data) + sz(observations.data) + sz(profile.data) + promBytes;
    setUsage({
      bytes,
      counts: {
        stars: stars.data?.length ?? 0,
        sessions: sessions.data?.length ?? 0,
        observations: observations.data?.length ?? 0,
        promOverrides: promCount,
      },
      loading: false,
    });
  };

  useEffect(() => { if (user) computeUsage(); /* eslint-disable-next-line */ }, [user]);

  const fmtBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-semibold mb-6">Nastavenia</h1>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">Všeobecné</TabsTrigger>
            <TabsTrigger value="billing">Plán & fakturácia</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="obs">Kód pozorovateľa (Obs)</Label>
            <Input id="obs" value={obsCode} onChange={(e) => setObsCode(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Použije sa vo VSNET / AAVSO / MEDUZA exportoch.</p>
          </div>
          <div>
            <Label htmlFor="ref">Fecha de Referencia</Label>
            <Input id="ref" type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
          </div>
          <Button onClick={save} disabled={busy}>Uložiť</Button>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Beta testing</h2>
                    <Badge variant="secondary" className="rounded-full">Aktívny plán</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Počas bety má každý používateľ rovnaký plán. Iné plány zatiaľ nie sú dostupné.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-primary">0 €</div>
                  <div className="text-xs text-muted-foreground">/ mesačne</div>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Všetky aktuálne funkcie aplikácie bez obmedzení</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Neobmedzený počet session, hviezd v katalógu a pozorovaní</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Exporty VSNET / AAVSO / MEDUZA, import .xlsx/.ods, JSON katalógov</span>
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>V budúcnosti: <strong className="text-foreground">5 AI skenov</strong> denne</span>
                </li>
              </ul>

              <Button className="mt-5" disabled variant="secondary">
                Iné plány nie sú dostupné
              </Button>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Využitie úložiska</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={computeUsage} disabled={usage.loading}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${usage.loading ? "animate-spin" : ""}`} /> Obnoviť
                </Button>
              </div>

              {(() => {
                const LIMIT = 1.8 * 1024 * 1024 * 1024; // 1.8 GB
                const pct = Math.min(100, (usage.bytes / LIMIT) * 100);
                return (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold">{fmtBytes(usage.bytes)}</span>
                      <span className="text-sm text-muted-foreground">/ 1.8 GB</span>
                    </div>
                    <Progress value={pct} className="mt-2 h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Využitých {pct.toFixed(2)} % z limitu plánu Beta testing. Veľkosť tvojich dát (hviezdy, session, pozorovania, prom katalóg).
                    </p>
                  </>
                );
              })()}

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {[
                  { label: "Hviezdy", v: usage.counts.stars },
                  { label: "Session", v: usage.counts.sessions },
                  { label: "Pozorovania", v: usage.counts.observations },
                  { label: "Prom úpravy", v: usage.counts.promOverrides },
                ].map((x) => (
                  <div key={x.label} className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">{x.label}</div>
                    <div className="text-lg font-semibold">{x.v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}