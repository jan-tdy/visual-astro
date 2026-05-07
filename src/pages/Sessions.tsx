import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Copy, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { dateToJD } from "@/lib/astro";
import { seedCatalogIfNeeded } from "@/lib/seed";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SessionRow {
  id: string;
  observed_at_utc: string;
  jd: number | null;
  notes: string | null;
  is_favorite?: boolean;
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
      .select("id, observed_at_utc, jd, notes, is_favorite, observations(ut_time)")
      .order("observed_at_utc", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setSessions(
        (data ?? []).map((s: any) => ({
          ...s,
          obs_count: (s.observations ?? []).filter(
            (o: any) => o.ut_time && String(o.ut_time).trim(),
          ).length,
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
    const s = sessions.find((x) => x.id === id);
    if (s?.is_favorite) {
      toast.error("Obľúbenú session nie je možné vymazať");
      return;
    }
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  const toggleFavorite = async (id: string, current: boolean) => {
    if (!current) {
      // Unset previous favorite, then set this one
      await supabase.from("sessions").update({ is_favorite: false }).eq("is_favorite", true);
    }
    const { error } = await supabase.from("sessions").update({ is_favorite: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(current ? "Odobraté z obľúbených" : "Pridané do obľúbených");
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
                    {s.is_favorite && <Star className="inline h-3.5 w-3.5 mr-1 text-primary fill-current" />}
                    {new Date(s.observed_at_utc).toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    JD {s.jd?.toFixed(4) ?? "—"} · {s.obs_count} pozorovaní
                    {s.notes ? ` · ${s.notes}` : ""}
                  </div>
                </Link>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={s.is_favorite ? "Odobrať z obľúbených" : "Pridať do obľúbených"}
                    onClick={() => toggleFavorite(s.id, !!s.is_favorite)}
                  >
                    {s.is_favorite ? (
                      <StarOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Star className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                  {!s.is_favorite && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Vymazať">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Vymazať session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Táto akcia natrvalo odstráni session zo dňa{" "}
                            {new Date(s.observed_at_utc).toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" })}{" "}
                            vrátane všetkých pozorovaní. Tento krok sa nedá vrátiť späť.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(s.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Vymazať
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}