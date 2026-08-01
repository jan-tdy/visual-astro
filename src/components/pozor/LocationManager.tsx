import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePozorLocations, type PozorLocationRow } from "@/components/pozor/shared";

type Draft = { id?: string; name: string; lat: string; lon: string; elevation: string };

const EMPTY_DRAFT: Draft = { name: "", lat: "", lon: "", elevation: "0" };

export function LocationManager() {
  const { t } = useI18n();
  const { locations, loading, reload } = usePozorLocations();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PozorLocationRow | null>(null);

  const openNew = () => setEditing({ ...EMPTY_DRAFT });
  const openEdit = (l: PozorLocationRow) =>
    setEditing({ id: l.id, name: l.name, lat: String(l.lat), lon: String(l.lon), elevation: String(l.elevation) });

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const lat = Number(editing.lat);
    const lon = Number(editing.lon);
    const elevation = editing.elevation.trim() === "" ? 0 : Number(editing.elevation);
    if (!name) {
      toast.error(t("pozor.loc.err.name"));
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      toast.error(t("pozor.loc.err.lat"));
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      toast.error(t("pozor.loc.err.lon"));
      return;
    }
    if (!Number.isFinite(elevation)) {
      toast.error(t("pozor.loc.err.elevation"));
      return;
    }
    setBusy(true);
    const payload = { name, lat, lon, elevation };
    const { error } = editing.id
      ? await supabase.from("pozor_locations").update(payload).eq("id", editing.id)
      : await supabase.from("pozor_locations").insert({ ...payload, sort_order: (locations.length + 1) * 10 });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("pozor.loc.saved"));
    setEditing(null);
    reload();
  };

  const remove = async (l: PozorLocationRow) => {
    const { error } = await supabase.from("pozor_locations").delete().eq("id", l.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("pozor.loc.deleted"));
      reload();
    }
    setConfirmDelete(null);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("pozor.loc.title")}</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{t("pozor.loc.desc")}</p>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {l.lat.toFixed(4)}, {l.lon.toFixed(4)} · {l.elevation} m
                </p>
              </div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(l)} title={t("pozor.loc.edit")}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(l)} title={t("pozor.loc.delete")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {!locations.length && <p className="text-sm text-muted-foreground py-2">{t("pozor.loc.empty")}</p>}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={openNew}>
        <Plus className="h-4 w-4 mr-1" /> {t("pozor.loc.add")}
      </Button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("pozor.loc.edit") : t("pozor.loc.add")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("pozor.loc.field.name")}</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Kolonica"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("pozor.loc.field.lat")}</Label>
                  <Input
                    inputMode="decimal"
                    value={editing.lat}
                    onChange={(e) => setEditing({ ...editing, lat: e.target.value })}
                    placeholder="48.935"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("pozor.loc.field.lon")}</Label>
                  <Input
                    inputMode="decimal"
                    value={editing.lon}
                    onChange={(e) => setEditing({ ...editing, lon: e.target.value })}
                    placeholder="22.2739"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.loc.field.elevation")}</Label>
                <Input
                  inputMode="decimal"
                  value={editing.elevation}
                  onChange={(e) => setEditing({ ...editing, elevation: e.target.value })}
                  placeholder="0"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {t("pozor.cancel")}
                </Button>
                <Button onClick={save} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {t("pozor.save")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pozor.loc.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pozor.loc.delete.desc").replace("{name}", confirmDelete?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pozor.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove(confirmDelete)}>
              {t("pozor.loc.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
