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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Sparkles, Database, RefreshCw, ExternalLink, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { getStripeEnvironment, PLUS_PRICE_ID } from "@/lib/stripe";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePrefs, SUBMISSION_PORTALS } from "@/hooks/usePrefs";
import { DEV_PLUS_KEY } from "@/hooks/useSubscription";
import { Zap } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { isPlusActive, sub, isDevUser, devOverride, setDevOverride } = useSubscription();
  const { prefs, update: setPrefs } = usePrefs();
  const [obsCode, setObsCode] = useState("DPV");
  const [refDate, setRefDate] = useState("1980-01-01");
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
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

  const openPortal = async () => {
    setPortalBusy(true);
    const { data, error } = await supabase.functions.invoke("create-portal-session", {
      body: { returnUrl: window.location.origin + "/settings", environment: getStripeEnvironment() },
    });
    setPortalBusy(false);
    if (error || !data?.url) {
      toast.error(error?.message || "Nepodarilo sa otvoriť správu predplatného");
      return;
    }
    window.open(data.url, "_blank");
  };

  const PLAN_LIMIT_MB = isPlusActive ? 800 : 200;
  const LIMIT_BYTES = PLAN_LIMIT_MB * 1024 * 1024;

  const toggleDevPlus = async () => {
    const next = !devOverride;
    await setDevOverride(next);
    toast.success(next ? "Plus aktivovaný (dev)" : "Plus deaktivovaný (dev)");
  };

  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-semibold mb-6">Nastavenia</h1>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">Všeobecné</TabsTrigger>
            <TabsTrigger value="billing">Plán & fakturácia</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="p-6 space-y-5">
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

            <Card className="p-6 space-y-5 mt-4">
              <h2 className="text-lg font-semibold">Pozorovanie & komfort</h2>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="autofill" className="flex items-center gap-2">
                    Auto-vyplniť čas
                    {!isPlusActive && (
                      <Badge variant="outline" className="rounded-full text-[10px] gap-1 px-2 py-0">
                        <Lock className="h-2.5 w-2.5" /> Plus
                      </Badge>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pri vstupe do prázdneho riadku sa do UT predvyplní aktuálny čas (hh:mm).
                  </p>
                </div>
                <Switch
                  id="autofill"
                  checked={isPlusActive && prefs.autofillUtNow}
                  disabled={!isPlusActive}
                  onCheckedChange={(v) => setPrefs({ autofillUtNow: v })}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="confirm">Potvrdenie pred mazaním</Label>
                  <p className="text-xs text-muted-foreground">
                    Pýtať potvrdenie pri mazaní hviezd v katalógu a Prom katalógu.
                  </p>
                </div>
                <Switch
                  id="confirm"
                  checked={prefs.confirmDelete}
                  onCheckedChange={(v) => setPrefs({ confirmDelete: v })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Oneskorenie auto-save</Label>
                  <span className="text-xs font-mono text-muted-foreground">{prefs.autosaveDelayMs} ms</span>
                </div>
                <Slider
                  min={300}
                  max={2000}
                  step={100}
                  value={[prefs.autosaveDelayMs]}
                  onValueChange={([v]) => setPrefs({ autosaveDelayMs: v })}
                />
                <p className="text-xs text-muted-foreground">
                  Kratšie = okamžité ukladanie, dlhšie = menej zápisov pri rýchlom písaní.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defcon" className="flex items-center gap-2">
                  Predvolené súhvezdie po otvorení session
                  {!isPlusActive && (
                    <Badge variant="outline" className="rounded-full text-[10px] gap-1 px-2 py-0">
                      <Lock className="h-2.5 w-2.5" /> Plus
                    </Badge>
                  )}
                </Label>
                <Select
                  value={prefs.defaultConstellation}
                  onValueChange={(v) => setPrefs({ defaultConstellation: v })}
                  disabled={!isPlusActive}
                >
                  <SelectTrigger id="defcon"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["AND","CAS","CAM","UMA","HER","DRA","CYG","ORI","GEM","LEO","AQL","SGE","PEG"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isPlusActive && (
                  <p className="text-xs text-muted-foreground">
                    Predvolené súhvezdie je dostupné v pláne <strong>Plus</strong>.
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6 space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Po stiahnutí exportu</h2>
                {!isPlusActive && (
                  <Badge variant="outline" className="rounded-full text-[10px] gap-1 px-2 py-0">
                    <Lock className="h-2.5 w-2.5" /> Plus
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Po stiahnutí súboru sa automaticky otvorí príslušná stránka v novom okne — pre rýchlejšie odoslanie pozorovaní.
              </p>
              {!isPlusActive && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Táto funkcia je dostupná v pláne <strong>Plus</strong>.
                </p>
              )}

              {(["aavso", "vsnet", "meduza"] as const).map((k) => (
                <div key={k} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <Label htmlFor={`portal-${k}`} className="uppercase">{k}</Label>
                      <p className="text-xs text-muted-foreground truncate">
                        {SUBMISSION_PORTALS[k].label}
                      </p>
                    </div>
                    <Switch
                      id={`portal-${k}`}
                      checked={isPlusActive && prefs.openPortalAfterExport[k]}
                      disabled={!isPlusActive}
                      onCheckedChange={(v) =>
                        setPrefs({
                          openPortalAfterExport: { ...prefs.openPortalAfterExport, [k]: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`portal-url-${k}`}
                      type="url"
                      placeholder={SUBMISSION_PORTALS[k].url}
                      value={prefs.portalUrls[k]}
                      onChange={(e) =>
                        setPrefs({
                          portalUrls: { ...prefs.portalUrls, [k]: e.target.value },
                        })
                      }
                      disabled={!isPlusActive || !prefs.openPortalAfterExport[k]}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPrefs({
                          portalUrls: { ...prefs.portalUrls, [k]: SUBMISSION_PORTALS[k].url },
                        })
                      }
                      title="Obnoviť predvolenú URL"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Free</h2>
                    {!isPlusActive && <Badge variant="secondary" className="rounded-full">Aktívny</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pre amatérskych pozorovateľov.
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
                  <span>Takmer všetky aktuálne funkcie aplikácie</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Exporty VSNET / AAVSO / MEDUZA, import .xlsx/.ods, JSON katalógov</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Limit úložiska <strong>200 MB</strong></span>
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>V budúcnosti: <strong className="text-foreground">5 AI skenov</strong> denne</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-primary/40">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Plus</h2>
                    {isPlusActive && <Badge className="rounded-full">Aktívny</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pre aktívnych pozorovateľov.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-primary">2 €</div>
                  <div className="text-xs text-muted-foreground">/ mesačne</div>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Všetky aktuálne funkcie aplikácie</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Exporty VSNET / AAVSO / MEDUZA, import .xlsx/.ods, JSON katalógov</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Limit úložiska <strong>800 MB</strong></span>
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>V budúcnosti: <strong className="text-foreground">15 AI skenov</strong> denne</span>
                </li>
              </ul>
              {isPlusActive ? (
                <Button className="mt-5 w-full" variant="secondary" onClick={openPortal} disabled={portalBusy}>
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Spravovať predplatné
                </Button>
              ) : (
                <Button className="mt-5 w-full" onClick={() => setCheckoutOpen(true)}>
                  Aktivovať Plus
                </Button>
              )}
              {isPlusActive && sub?.current_period_end && (
                <p className="text-xs text-muted-foreground mt-2">
                  {sub.cancel_at_period_end ? "Predplatné končí " : "Ďalšia fakturácia "}
                  <strong>
                    {new Date(sub.current_period_end).toLocaleDateString("sk-SK", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </strong>
                  .
                </p>
              )}
            </Card>
            </div>

            {isDevUser && (
              <Card className="p-6 border-accent/40 bg-accent/5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent" />
                      <h3 className="font-semibold">Dev override — Plus zadarmo</h3>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Si prihlásený ako vývojár ({user?.email}). Jedným klikom si môžeš zapnúť alebo vypnúť plán Plus bez platby.
                    </p>
                  </div>
                  <Switch checked={devOverride} onCheckedChange={toggleDevPlus} />
                </div>
              </Card>
            )}

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
                const pct = Math.min(100, (usage.bytes / LIMIT_BYTES) * 100);
                return (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold">{fmtBytes(usage.bytes)}</span>
                      <span className="text-sm text-muted-foreground">/ {PLAN_LIMIT_MB} MB</span>
                    </div>
                    <Progress value={pct} className="mt-2 h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Využitých {pct.toFixed(2)} % z limitu plánu {isPlusActive ? "Plus" : "Free"}. Veľkosť tvojich dát (hviezdy, session, pozorovania, prom katalóg).
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

        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aktivovať plán Plus — 2 € / mesačne</DialogTitle>
            </DialogHeader>
            {checkoutOpen && user && (
              <StripeEmbeddedCheckout
                priceId={PLUS_PRICE_ID}
                customerEmail={user.email ?? undefined}
                userId={user.id}
                returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}