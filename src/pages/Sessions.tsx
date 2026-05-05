import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { dateToJD } from "@/lib/astro";
import { seedCatalogIfNeeded } from "@/lib/seed";

interface SessionRow {
  id: string;
  observed_at_utc: string;
  jd: number | null;
  notes: string | null;
  obs_count?: number;
}

export default function Sessions() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await seedCatalogIfNeeded(user.id);
      } catch (e: any) {
        console.error(e);
        toast.error("Seed katalógu zlyhal: " + e.message);
      }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, observed_at_utc, jd, notes, observations(count)")
      .order("observed_at_utc", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setSessions(
        (data ?? []).map((s: any) => ({
          ...s,
          obs_count: s.observations?.[0]?.count ?? 0,
        })),
      );
    }
    setLoading(false);
  };

  const newSession = async (fromTemplate: boolean) => {
    if (!user) return;
    const now = new Date();
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, observed_at_utc: now.toISOString(), jd: dateToJD(now) })
      .select()
      .single();
    if (error) return toast.error(error.message);

    if (fromTemplate && sessions.length > 0) {
      const last = sessions[0];
      const { data: lastObs } = await supabase
        .from("observations")
        .select("star_id, a, pasos_a, pasos_b, b, limit_value, ut_time, note")
        .eq("session_id", last.id);
      if (lastObs && lastObs.length > 0) {
        const rows = lastObs.map((o) => ({
          ...o,
          ut_time: null,
          session_id: created.id,
          user_id: user.id,
        }));
        for (let i = 0; i < rows.length; i += 100) {
          await supabase.from("observations").insert(rows.slice(i, i + 100));
        }
      }
    }
    nav(`/session/${created.id}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať session?")) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Pozorovacie session</h1>
            <p className="text-sm text-muted-foreground">Záznamy odhadov magnitúd premenných hviezd</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => newSession(true)}>
              <Copy className="h-4 w-4 mr-1.5" /> Nová z poslednej
            </Button>
            <Button variant="outline" onClick={() => newSession(false)}>
              <Plus className="h-4 w-4 mr-1.5" /> Prázdna
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Zatiaľ žiadne session.
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Card key={s.id} className="p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                <Link to={`/session/${s.id}`} className="flex-1">
                  <div className="font-medium">
                    {new Date(s.observed_at_utc).toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    JD {s.jd?.toFixed(4) ?? "—"} · {s.obs_count} pozorovaní
                    {s.notes ? ` · ${s.notes}` : ""}
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}