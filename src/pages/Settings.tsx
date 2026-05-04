import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [obsCode, setObsCode] = useState("DPV");
  const [refDate, setRefDate] = useState("1980-01-01");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-semibold mb-6">Nastavenia</h1>
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
      </main>
    </div>
  );
}