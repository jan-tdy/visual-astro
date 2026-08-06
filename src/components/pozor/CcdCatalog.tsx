import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowDown, ArrowUp, Download, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useSubscription } from "@/hooks/useSubscription";
import { formatDMS, formatHMS } from "@/lib/pozor";
import { CcdTarget, downloadText, sortTargets } from "./shared";

/** Accepts "7.19056", "07 11 26.0" or "07h11m26.0s" → hours. */
export function parseSexagesimal(raw: string): number | null {
  const s = raw.trim().replace(/[hdms°′″'"]/g, " ").replace(/,/g, ".");
  if (!s) return null;
  const parts = s.split(/\s+/).filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 1) return parts[0];
  const sign = /^\s*-/.test(raw) ? -1 : 1;
  const [a, b = 0, c = 0] = parts.map(Math.abs);
  return sign * (a + b / 60 + c / 3600);
}

const num = (v: number | null | undefined, digits = 5) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);

export function CcdCatalog({
  targets,
  loading,
  reload,
  catalogId,
  catalogName,
  isOwnCatalog,
  ownCatalogsCount,
  setCatalogId,
  reloadCatalogs,
}: {
  targets: CcdTarget[];
  loading: boolean;
  reload: () => void;
  catalogId: string;
  catalogName: string;
  isOwnCatalog: boolean;
  ownCatalogsCount: number;
  setCatalogId: (id: string) => void;
  reloadCatalogs: () => void;
}) {
  const { t } = useI18n();
  const { isPlusActive } = useSubscription();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Partial<CcdTarget> | null>(null);
  const [raText, setRaText] = useState("");
  const [decText, setDecText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CcdTarget | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The active catalog may be the shared default (not owned by this user). Any write
   * forks a personal copy first — the default itself is never mutated — and switches
   * the active catalog to it. Returns the catalog id new writes should target, or null
   * if forking failed / there's genuinely no catalog to write to yet.
   */
  const ensureOwnCatalog = async (): Promise<string | null> => {
    if (isOwnCatalog) {
      if (!catalogId) {
        toast.error(t("pozor.cat.err.noCatalog"));
        return null;
      }
      return catalogId;
    }
    if (!isPlusActive && ownCatalogsCount >= 1) {
      toast.error(t("pozor.catalog.plusRequired"));
      return null;
    }
    const { data: created, error: createErr } = await supabase
      .from("ccd_catalogs")
      .insert({ name: catalogName || "Katalóg", sort_order: 0 })
      .select("id")
      .single();
    if (createErr || !created) {
      toast.error(createErr?.message ?? t("pozor.cat.err.noCatalog"));
      return null;
    }
    if (targets.length) {
      const clones = targets.map(({ id, catalog_id, ...rest }) => ({ ...rest, catalog_id: created.id }));
      const { error: cloneErr } = await supabase.from("ccd_targets").insert(clones);
      if (cloneErr) {
        toast.error(cloneErr.message);
        return null;
      }
    }
    toast.success(t("pozor.catalog.forked"));
    reloadCatalogs();
    setCatalogId(created.id);
    return created.id;
  };

  const filtered = useMemo(
    () =>
      sortTargets(
        targets.filter((x) =>
          `${x.name} ${x.constellation} ${x.filters ?? ""} ${x.notes ?? ""}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
        ),
      ),
    [targets, filter],
  );

  const openNew = async () => {
    const cid = await ensureOwnCatalog();
    if (!cid) return;
    setEditing({
      catalog_id: cid,
      name: "",
      constellation: "",
      ra_hours: 0,
      dec_deg: 0,
      sort_order: (targets.length + 1) * 10,
    });
    setRaText("");
    setDecText("");
  };

  const openEdit = (x: CcdTarget) => {
    setEditing({ ...x });
    setRaText(String(x.ra_hours));
    setDecText(String(x.dec_deg));
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.catalog_id) {
      toast.error(t("pozor.cat.err.noCatalog"));
      return;
    }
    const name = (editing.name ?? "").trim();
    if (!name) {
      toast.error(t("pozor.cat.err.name"));
      return;
    }
    const ra = parseSexagesimal(raText);
    const dec = parseSexagesimal(decText);
    if (ra == null || ra < 0 || ra >= 24) {
      toast.error(t("pozor.cat.err.ra"));
      return;
    }
    if (dec == null || dec < -90 || dec > 90) {
      toast.error(t("pozor.cat.err.dec"));
      return;
    }
    setBusy(true);
    const payload = {
      catalog_id: editing.catalog_id,
      name,
      constellation: (editing.constellation ?? "").trim().toUpperCase(),
      ra_hours: ra,
      dec_deg: dec,
      epoch_jd: editing.epoch_jd ?? null,
      period_days: editing.period_days ?? null,
      filters: editing.filters?.trim() || null,
      notes: editing.notes?.trim() || null,
      sort_order: editing.sort_order ?? 0,
    };
    const { error } = editing.id
      ? await supabase.from("ccd_targets").update(payload).eq("id", editing.id)
      : await supabase.from("ccd_targets").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("pozor.cat.saved"));
    setEditing(null);
    reload();
  };

  const remove = async (x: CcdTarget) => {
    if (!isOwnCatalog) return;
    const { error } = await supabase.from("ccd_targets").delete().eq("id", x.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("pozor.cat.deleted"));
      reload();
    }
    setConfirmDelete(null);
  };

  const move = async (x: CcdTarget, dir: -1 | 1) => {
    if (!isOwnCatalog) return;
    const siblings = targets
      .filter((s) => s.constellation === x.constellation)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const idx = siblings.findIndex((s) => s.id === x.id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= siblings.length) return;
    const reordered = siblings.slice();
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(next, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      const { error } = await supabase
        .from("ccd_targets")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", reordered[i].id);
      if (error) {
        toast.error(error.message);
        break;
      }
    }
    reload();
  };

  const exportJson = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      `ccd_katalog_${date}.json`,
      JSON.stringify(
        targets.map(({ id, catalog_id, ...rest }) => rest),
        null,
        2,
      ),
      "application/json",
    );
    toast.success(t("pozor.cat.exported"));
  };

  const importJson = async (file: File) => {
    const cid = await ensureOwnCatalog();
    if (!cid) return;
    try {
      const rows = JSON.parse(await file.text());
      if (!Array.isArray(rows)) throw new Error("not an array");
      const payload = rows
        .filter((r: any) => r && typeof r.name === "string")
        .map((r: any, i: number) => ({
          catalog_id: cid,
          name: String(r.name),
          constellation: String(r.constellation ?? "").toUpperCase(),
          ra_hours: Number(r.ra_hours) || 0,
          dec_deg: Number(r.dec_deg) || 0,
          epoch_jd: r.epoch_jd == null ? null : Number(r.epoch_jd),
          period_days: r.period_days == null ? null : Number(r.period_days),
          filters: r.filters ?? null,
          notes: r.notes ?? null,
          sort_order: Number(r.sort_order) || (i + 1) * 10,
        }));
      if (!payload.length) throw new Error("empty");
      const { error } = await supabase.from("ccd_targets").insert(payload);
      if (error) throw error;
      toast.success(t("pozor.cat.imported").replace("{n}", String(payload.length)));
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    }
  };

  return (
    <Card className="p-4 space-y-4">
      {!isOwnCatalog && <p className="text-xs text-muted-foreground">{t("pozor.catalog.sharedHint")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("pozor.search")}
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Button size="sm" onClick={openNew} disabled={!catalogId}>
          <Plus className="h-4 w-4 mr-1" /> {t("pozor.cat.add")}
        </Button>
        <Button size="sm" variant="outline" onClick={exportJson}>
          <Download className="h-4 w-4 mr-1" /> {t("pozor.cat.export")}
        </Button>
        <Button size="sm" variant="outline" asChild disabled={!catalogId}>
          <label className={catalogId ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
            <Upload className="h-4 w-4 mr-1" /> {t("catalog.import")}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              disabled={!catalogId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </Button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t("pozor.cat.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.name")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.const")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.ra")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.dec")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.epoch")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.period")}</th>
                <th className="text-left py-2 pr-2">{t("pozor.cat.col.filters")}</th>
                <th className="text-right py-2">{t("pozor.cat.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-2 font-medium">{x.name}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{x.constellation}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{formatHMS(x.ra_hours)}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{formatDMS(x.dec_deg)}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{num(x.epoch_jd)}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{num(x.period_days, 6)}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{x.filters ?? "—"}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(x, -1)}
                      disabled={!isOwnCatalog}
                      title={isOwnCatalog ? t("pozor.cat.up") : t("pozor.catalog.sharedHint")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(x, 1)}
                      disabled={!isOwnCatalog}
                      title={isOwnCatalog ? t("pozor.cat.down") : t("pozor.catalog.sharedHint")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(x)}
                      disabled={!isOwnCatalog}
                      title={isOwnCatalog ? t("pozor.cat.edit") : t("pozor.catalog.sharedHint")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(x)}
                      disabled={!isOwnCatalog}
                      title={isOwnCatalog ? t("pozor.cat.delete") : t("pozor.catalog.sharedHint")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("pozor.cat.edit") : t("pozor.cat.new")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("pozor.cat.col.name")}</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="V808 Aur"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.col.const")}</Label>
                <Input
                  value={editing.constellation ?? ""}
                  onChange={(e) => setEditing({ ...editing, constellation: e.target.value })}
                  placeholder="AURIGA"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.field.ra")}</Label>
                <Input value={raText} onChange={(e) => setRaText(e.target.value)} placeholder="07 11 26.0" />
                <p className="text-[11px] text-muted-foreground">{t("pozor.cat.field.raHint")}</p>
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.field.dec")}</Label>
                <Input value={decText} onChange={(e) => setDecText(e.target.value)} placeholder="+44 04 05" />
                <p className="text-[11px] text-muted-foreground">{t("pozor.cat.field.decHint")}</p>
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.col.epoch")}</Label>
                <Input
                  inputMode="decimal"
                  value={editing.epoch_jd ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, epoch_jd: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  placeholder="2461060.32140"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.col.period")}</Label>
                <Input
                  inputMode="decimal"
                  value={editing.period_days ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, period_days: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  placeholder="0.081377"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.col.filters")}</Label>
                <Input
                  value={editing.filters ?? ""}
                  onChange={(e) => setEditing({ ...editing, filters: e.target.value })}
                  placeholder="V60R30"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("pozor.cat.col.notes")}</Label>
                <Input
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {t("pozor.cancel")}
                </Button>
                <Button onClick={save} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {t("pozor.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pozor.cat.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pozor.cat.delete.desc").replace("{name}", confirmDelete?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pozor.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove(confirmDelete)}>
              {t("pozor.cat.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}