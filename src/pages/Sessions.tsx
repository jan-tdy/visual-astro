import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Copy, Star, StarOff, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { computeMagnitude, dateToJD } from "@/lib/astro";
import { getPrefs } from "@/hooks/usePrefs";
import { seedCatalogIfNeeded } from "@/lib/seed";
import { useI18n } from "@/hooks/useI18n";
import { useSubscription } from "@/hooks/useSubscription";
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
  name?: string | null;
  is_favorite?: boolean;
  obs_count?: number;
}

export default function Sessions() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const { activeBonus, isBonusActive, markBonusSeen } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await seedCatalogIfNeeded(user.id);
      } catch (e: any) {
        console.error(e);
        toast.error(`${t("sessions.seedFailed")}: ${e.message}`);
      }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, observed_at_utc, jd, notes, name, is_favorite, observations(ut_time, star_id, a, pasos_a, pasos_b, b, limit_value)")
      .order("observed_at_utc", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      const { data: starRows } = await supabase.from("stars").select("id, name");
      const starNameById = new Map((starRows ?? []).map((s) => [s.id, s.name]));
      const compLabelThreshold = getPrefs().compLabelThreshold;
      setSessions(
        (data ?? []).map((s: any) => ({
          ...s,
          // Matches the editor's own "filled" definition: a UT time alone isn't enough,
          // the magnitude has to be computable too, or the export/graphs skip the row anyway.
          obs_count: (s.observations ?? []).filter(
            (o: any) =>
              o.ut_time && String(o.ut_time).trim() &&
              computeMagnitude(o, starNameById.get(o.star_id), compLabelThreshold).value !== null,
          ).length,
        })),
      );
    }
    setLoading(false);
  };

  const newSession = async (source: "empty" | "last" | "favorite") => {
    if (!user) return;
    let templateId: string | null = null;
    if (source === "last" && sessions.length > 0) templateId = sessions[0].id;
    if (source === "favorite") {
      const fav = sessions.find((s) => s.is_favorite);
      if (!fav) {
        toast.error(t("sessions.noFavorite"));
        return;
      }
      templateId = fav.id;
    }
    const now = new Date();
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, observed_at_utc: now.toISOString(), jd: dateToJD(now) })
      .select()
      .single();
    if (error) return toast.error(error.message);

    if (templateId) {
      const { data: lastObs } = await supabase
        .from("observations")
        .select("star_id, a, pasos_a, pasos_b, b, limit_value, ut_time, note")
        .eq("session_id", templateId);
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
      toast.error(t("sessions.favProtected"));
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
    toast.success(current ? t("sessions.favRemoved") : t("sessions.favAdded"));
    reload();
  };

  const hasFavorite = sessions.some((s) => s.is_favorite);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isBonusActive && activeBonus && !activeBonus.seen && (
          <Card className="p-4 mb-4 border-primary/40 bg-primary/5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">🎉 {activeBonus.reason}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("sessions.bonus.activeUntil")} {new Date(activeBonus.expires_at).toLocaleString(lang === "sk" ? "sk-SK" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}. {t("sessions.bonus.enjoy")}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={markBonusSeen} title={t("common.close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{t("sessions.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("sessions.subtitle")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => newSession("last")}>
              <Copy className="h-4 w-4 mr-1.5" /> {t("sessions.newFromLast")}
            </Button>
            {hasFavorite && (
              <Button variant="secondary" onClick={() => newSession("favorite")}>
                <Star className="h-4 w-4 mr-1.5 fill-current" /> {t("sessions.newFromFavorite")}
              </Button>
            )}
            <Button variant="outline" onClick={() => newSession("empty")}>
              <Plus className="h-4 w-4 mr-1.5" /> {t("sessions.empty")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {t("sessions.none")}
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Card key={s.id} className="p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                <Link to={`/session/${s.id}`} className="flex-1">
                  <div className="font-medium">
                    {s.is_favorite && <Star className="inline h-3.5 w-3.5 mr-1 text-primary fill-current" />}
                    {s.name ? (
                      <>
                        {s.name}
                        <span className="text-muted-foreground font-normal"> · {new Date(s.observed_at_utc).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB", { dateStyle: "medium" })}</span>
                      </>
                    ) : (
                      new Date(s.observed_at_utc).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB", { dateStyle: "medium" })
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    JD {s.jd?.toFixed(4) ?? "—"} · {s.obs_count} {t("sessions.observations")}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </div>
                </Link>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={s.is_favorite ? t("sessions.favoriteRemove") : t("sessions.favoriteAdd")}
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
                        <Button variant="ghost" size="icon" title={t("common.delete")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("sessions.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("sessions.deleteDesc")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(s.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("common.delete")}
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