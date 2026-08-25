import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, Download, Upload, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/hooks/useI18n";
import { getPrefs } from "@/hooks/usePrefs";

type Star = {
  id: string;
  name: string;
  constellation: string;
  type: "VISUAL" | "BINAR" | "ECL faint" | "ECL bright";
  vsnet_code: string | null;
  aavso_code: string | null;
  chart_id: string | null;
  notes: string | null;
  sort_order: number;
};

const TYPES = ["VISUAL", "BINAR", "ECL faint", "ECL bright"] as const;

const CONSTELLATIONS = [
  "ANDROMEDA","AQUARIUS","AQUILA","ARIES","AURIGA","BOOTES","CAMELOPARDALIS",
  "CANCER","CANES VENATICI","CANIS MAIOR","CANIS MINOR","CAPRICORNUS","CASSIOPEA",
  "CEPHEUS","CETUS","COMA BERENICES","CORONA BOREALIS","CORVUS","CRATER","CYGNUS",
  "DELPHINUS","DRACO","EQUULEUS","ERIDANUS","GEMINI","HERCULES","HYDRA",
  "LACERTA","LEO","LEO MINOR","LEPUS","LIBRA","LYNX","LYRA","MONOCEROS",
  "OPHIUCHUS","ORION","PEGASUS","PERSEUS","PISCES","PUPPIS","SAGITTA",
  "SAGITTARIUS","SCORPIUS","SCUTUM","SERPENS","SEXTANS","TAURUS","TRIANGULUM",
  "URSA MAIOR","URSA MINOR","VIRGO","VULPECULA",
] as const;
const OTHER_CONST = "__other__";

const sortStars = (items: Star[]) =>
  [...items].sort(
    (a, b) =>
      a.constellation.localeCompare(b.constellation) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

const sortConstellationStars = (items: Star[]) =>
  [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

export default function Catalog() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stars, setStars] = useState<Star[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Star | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Star | null>(null);
  const [confirmImport, setConfirmImport] = useState<{ data: any[]; replace: boolean } | null>(null);

  const reload = async () => {
    setLoading(true);
    // Paginated fetch — PostgREST caps single requests at ~1000 rows, and a growing
    // custom catalog can exceed that, silently hiding stars past the cap otherwise.
    const { data, error } = await fetchAllRows<Star>((from, to) =>
      supabase.from("stars").select("*").order("constellation").order("sort_order").range(from, to),
    );
    if (error) toast.error(error.message);
    setStars(sortStars(data));
    setLoading(false);
  };
  useEffect(() => {
    if (user) reload();
  }, [user]);

  const filtered = sortStars(
    stars.filter((s) =>
      `${s.name} ${s.constellation} ${s.vsnet_code ?? ""} ${s.aavso_code ?? ""}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ),
  );

  const moveStar = async (s: Star, dir: -1 | 1) => {
    // siblings within same constellation, in displayed order (stable by name as tiebreaker)
    const siblings = sortConstellationStars(stars.filter((x) => x.constellation === s.constellation));
    const idx = siblings.findIndex((x) => x.id === s.id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    // Reorder array
    const reordered = siblings.slice();
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);
    // Re-assign distinct sort_order values (10,20,30…) so future swaps always work
    const updates = reordered.map((star, i) => ({ id: star.id, sort_order: (i + 1) * 10 }));
    // optimistic UI
    const updateMap = new Map(updates.map((u) => [u.id, u.sort_order]));
    setStars((prev) =>
      sortStars(prev.map((x) => (updateMap.has(x.id) ? { ...x, sort_order: updateMap.get(x.id)! } : x))),
    );
    // Persist — run sequentially to avoid races, abort on first error
    for (const u of updates) {
      const { error } = await supabase.from("stars").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) {
        toast.error(error.message);
        reload();
        return;
      }
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("stars").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("catalog.toast.deleted")); reload(); }
  };

  const saveEdit = async (s: Star) => {
    const { error } = await supabase
      .from("stars")
      .update({
        name: s.name,
        constellation: s.constellation,
        type: s.type,
        vsnet_code: s.vsnet_code,
        aavso_code: s.aavso_code,
        chart_id: s.chart_id,
        notes: s.notes,
      })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("catalog.toast.saved"));
      setEditing(null);
      reload();
    }
  };

  const createStar = async (s: Omit<Star, "id" | "sort_order">) => {
    if (!user) return;
    const max = Math.max(0, ...stars.map((x) => x.sort_order));
    const { error } = await supabase.from("stars").insert({
      ...s,
      user_id: user.id,
      sort_order: max + 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(t("catalog.toast.added"));
      setCreating(false);
      reload();
    }
  };

  const exportJSON = () => {
    const payload = stars.map(({ id, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `katalog_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error(t("catalog.toast.invalidArr"));
        setConfirmImport({ data: parsed, replace: false });
      } catch (e: any) {
        toast.error(t("catalog.toast.invalidJson") + ": " + e.message);
      }
    };
    reader.readAsText(file);
  };

  const runImport = async (replace: boolean) => {
    if (!user || !confirmImport) return;
    const { data } = confirmImport;
    if (replace) {
      const { error: delErr } = await supabase.from("stars").delete().eq("user_id", user.id);
      if (delErr) { toast.error(delErr.message); return; }
    }
    const baseSort = replace ? 0 : Math.max(0, ...stars.map((x) => x.sort_order));
    const rows = data.map((s: any, i: number) => ({
      user_id: user.id,
      name: String(s.name ?? "").trim(),
      constellation: String(s.constellation ?? "").trim(),
      type: (TYPES as readonly string[]).includes(s.type) ? s.type : "VISUAL",
      vsnet_code: s.vsnet_code ?? null,
      aavso_code: s.aavso_code ?? null,
      chart_id: s.chart_id ?? null,
      notes: s.notes ?? null,
      sort_order: typeof s.sort_order === "number" ? s.sort_order : baseSort + i + 1,
    })).filter((r) => r.name && r.constellation);
    if (rows.length === 0) { toast.error(t("catalog.toast.noRows")); setConfirmImport(null); return; }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("stars").insert(rows.slice(i, i + 200));
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t("catalog.toast.imported").replace("{n}", String(rows.length)));
    setConfirmImport(null);
    reload();
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">{t("catalog.title")}</h1>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder={t("catalog.search")} value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48" />
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="h-4 w-4 mr-1.5" /> JSON
            </Button>
            <label className="inline-flex">
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1.5" /> {t("catalog.import")}
                </span>
              </Button>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> {t("catalog.add")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr className="text-left">
                  <th className="px-3 py-2">{t("catalog.col.star")}</th>
                  <th className="px-3 py-2">{t("catalog.col.constellation")}</th>
                  <th className="px-3 py-2">{t("catalog.col.type")}</th>
                  <th className="px-3 py-2">{t("catalog.col.vsnet")}</th>
                  <th className="px-3 py-2">{t("catalog.col.aavso")}</th>
                  <th className="px-3 py-2">{t("catalog.col.chart")}</th>
                  <th className="px-3 py-2 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const siblings = sortConstellationStars(stars.filter((x) => x.constellation === s.constellation));
                  const pos = siblings.findIndex((x) => x.id === s.id);
                  const canUp = pos > 0;
                  const canDown = pos >= 0 && pos < siblings.length - 1;
                  return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setEditing(s)}>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.constellation}</td>
                    <td className="px-3 py-2 text-xs">{s.type}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.vsnet_code}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.aavso_code}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.chart_id}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" disabled={!canUp} aria-label={t("catalog.moveUp")} title={t("catalog.moveUp")} onClick={(e) => { e.stopPropagation(); moveStar(s, -1); }}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={!canDown} aria-label={t("catalog.moveDown")} title={t("catalog.moveDown")} onClick={(e) => { e.stopPropagation(); moveStar(s, 1); }}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.delete")}
                        title={t("common.delete")}

                        onClick={(e) => {
                          e.stopPropagation();
                          if (getPrefs().confirmDelete) setConfirmDelete(s);
                          else remove(s.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      <StarDialog
        open={!!editing || creating}
        star={editing}
        usedConstellations={Array.from(new Set(stars.map((s) => s.constellation))).sort()}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(s) => {
          if (editing) saveEdit({ ...editing, ...s });
          else createStar(s);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalog.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalog.delete.desc").replace("{name}", confirmDelete?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirmDelete?.id;
                setConfirmDelete(null);
                if (id) remove(id);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmImport} onOpenChange={(o) => !o && setConfirmImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalog.import.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalog.import.desc").replace("{n}", String(confirmImport?.data.length ?? 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="outline" onClick={() => runImport(false)}>{t("catalog.import.append")}</Button>
            <AlertDialogAction onClick={() => runImport(true)}>{t("catalog.import.replace")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StarDialog({
  open, star, usedConstellations, onClose, onSave,
}: {
  open: boolean;
  star: Star | null;
  usedConstellations: string[];
  onClose: () => void;
  onSave: (s: any) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "", constellation: "", type: "VISUAL" as Star["type"],
    vsnet_code: "", aavso_code: "", chart_id: "", notes: "",
  });
  const [constMode, setConstMode] = useState<"preset" | "other">("preset");
  useEffect(() => {
    if (star) {
      setForm({
        name: star.name, constellation: star.constellation, type: star.type,
        vsnet_code: star.vsnet_code ?? "", aavso_code: star.aavso_code ?? "",
        chart_id: star.chart_id ?? "", notes: star.notes ?? "",
      });
      setConstMode(usedConstellations.includes(star.constellation) ? "preset" : "other");
    } else if (open) {
      setForm({ name: "", constellation: "", type: "VISUAL", vsnet_code: "", aavso_code: "", chart_id: "", notes: "" });
      setConstMode("preset");
    }
  }, [star, open, usedConstellations]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{star ? t("catalog.dialog.edit") : t("catalog.dialog.new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("catalog.dialog.name")}</Label>
            <Input
              placeholder={t("catalog.dialog.namePh")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">{t("catalog.dialog.nameHint")}</p>
          </div>
          <div>
            <Label>{t("catalog.col.constellation")}</Label>
            <Select
              value={constMode === "other" ? OTHER_CONST : (form.constellation || undefined)}
              onValueChange={(v) => {
                if (v === OTHER_CONST) {
                  setConstMode("other");
                  setForm({ ...form, constellation: "" });
                } else {
                  setConstMode("preset");
                  setForm({ ...form, constellation: v });
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder={t("catalog.dialog.constPick")} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {usedConstellations.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value={OTHER_CONST}>{t("catalog.dialog.constOther")}</SelectItem>
              </SelectContent>
            </Select>
            {constMode === "other" && (
              <Input
                className="mt-2"
                placeholder={t("catalog.dialog.constPh")}
                value={form.constellation}
                onChange={(e) => setForm({ ...form, constellation: e.target.value.toUpperCase() })}
                autoFocus
              />
            )}
            <p className="text-xs text-muted-foreground mt-1">{t("catalog.dialog.constHint")}</p>
          </div>
          <div>
            <Label>{t("catalog.col.type")}</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("catalog.dialog.typeHint")}</p>
          </div>
          {(
            [
              { k: "vsnet_code", label: t("catalog.dialog.vsnet"), ph: t("catalog.dialog.vsnetPh"), hint: t("catalog.dialog.vsnetHint") },
              { k: "aavso_code", label: t("catalog.dialog.aavso"), ph: t("catalog.dialog.aavsoPh"), hint: t("catalog.dialog.aavsoHint") },
              { k: "chart_id", label: t("catalog.dialog.chart"), ph: t("catalog.dialog.chartPh"), hint: t("catalog.dialog.chartHint") },
              { k: "notes", label: t("catalog.dialog.notes"), ph: t("catalog.dialog.notesPh"), hint: t("catalog.dialog.notesHint") },
            ] as const
          ).map(({ k, label, ph, hint }) => (
            <div key={k}>
              <Label>{label}</Label>
              <Input
                placeholder={ph}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            </div>
          ))}
          <Button className="w-full" onClick={() => onSave({ ...form, vsnet_code: form.vsnet_code || null, aavso_code: form.aavso_code || null, chart_id: form.chart_id || null, notes: form.notes || null })}>
            <Save className="h-4 w-4 mr-1.5" /> {t("catalog.dialog.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}