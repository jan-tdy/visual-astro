import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Download, Upload, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deletePromStar, exportPromJSON, getPromTable, importPromJSON,
  renamePromStar, resetPromOverrides, subscribePromStore, upsertPromStar,
} from "@/lib/promStore";
import { useI18n } from "@/hooks/useI18n";

type Row = { name: string; letters: Record<string, number> };

export default function Prom() {
  const { lang } = useI18n();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => subscribePromStore(() => setTick((x) => x + 1)), []);

  const rows = useMemo<Row[]>(() => {
    const tbl = getPromTable();
    return Object.entries(tbl)
      .map(([name, letters]) => ({ name, letters }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tick]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));

  const tr = (sk: string, en: string) => (lang === "sk" ? sk : en);

  const onExport = () => {
    const blob = new Blob([exportPromJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prom.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPromJSON(String(reader.result));
        toast.success(tr("Importované", "Imported"));
      } catch (e: any) {
        toast.error(e.message ?? "Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{tr("Katalóg prom", "Prom catalog")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tr(
                "Tabuľka porovnávacích hviezd: písmenám (a, b, c…) priradíš magnitúdu. Tieto hodnoty sa používajú pri výpočte v editore session.",
                "Comparison-star table: assign a magnitude to each letter (a, b, c…). These values are used by the magnitude calculation in the session editor.",
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder={tr("Hľadať…", "Search…")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-48"
            />
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-1.5" /> JSON
            </Button>
            <label className="inline-flex">
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1.5" /> Import
                </span>
              </Button>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> {tr("Reset", "Reset")}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> {tr("Pridať", "Add")}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          {tr("Spolu hviezd:", "Total stars:")} {rows.length}
        </p>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40">
              <tr className="text-left">
                <th className="px-3 py-2 w-48">{tr("Hviezda", "Star")}</th>
                <th className="px-3 py-2">{tr("Písmená → magnitúdy", "Letters → magnitudes")}</th>
                <th className="px-3 py-2 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const entries = Object.entries(r.letters).sort(([a], [b]) => a.localeCompare(b));
                return (
                  <tr
                    key={r.name}
                    className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                    onClick={() => setEditing(r)}
                  >
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {entries.map(([k, v]) => `${k}=${v}`).join("  ")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setConfirmDelete(r.name); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                    {tr("Žiadne hviezdy.", "No stars.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>

      <PromDialog
        open={!!editing || creating}
        row={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        lang={lang}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Vymazať hviezdu?", "Delete star?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `Naozaj chceš odstrániť „${confirmDelete}" z katalógu prom? Túto akciu môžeš vrátiť tlačidlom Reset.`,
                `Remove "${confirmDelete}" from the prom catalog? You can revert this with the Reset button.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Zrušiť", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deletePromStar(confirmDelete);
                setConfirmDelete(null);
                toast.success(tr("Vymazané", "Deleted"));
              }}
            >
              {tr("Vymazať", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Resetovať katalóg?", "Reset catalog?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                "Všetky tvoje úpravy sa zahodia a katalóg sa vráti k pôvodným hodnotám.",
                "All your edits will be discarded and the catalog will revert to its original values.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Zrušiť", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resetPromOverrides(); setConfirmReset(false); toast.success(tr("Resetované", "Reset")); }}
            >
              {tr("Resetovať", "Reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PromDialog({
  open, row, onClose, lang,
}: {
  open: boolean;
  row: Row | null;
  onClose: () => void;
  lang: "sk" | "en";
}) {
  const tr = (sk: string, en: string) => (lang === "sk" ? sk : en);
  const [name, setName] = useState("");
  const [pairs, setPairs] = useState<{ letter: string; mag: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    if (row) {
      setName(row.name);
      setPairs(
        Object.entries(row.letters)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([letter, mag]) => ({ letter, mag: String(mag) })),
      );
    } else {
      setName("");
      setPairs([{ letter: "a", mag: "" }]);
    }
  }, [open, row]);

  const addPair = () => setPairs([...pairs, { letter: "", mag: "" }]);
  const removePair = (i: number) => setPairs(pairs.filter((_, j) => j !== i));

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(tr("Zadaj názov hviezdy", "Enter a star name"));
      return;
    }
    const letters: Record<string, number> = {};
    for (const p of pairs) {
      const k = p.letter.trim().toLowerCase();
      const v = parseFloat(p.mag);
      if (!k) continue;
      if (!Number.isFinite(v)) {
        toast.error(tr(`Neplatná magnitúda pre „${k}"`, `Invalid magnitude for "${k}"`));
        return;
      }
      letters[k] = v;
    }
    if (Object.keys(letters).length === 0) {
      toast.error(tr("Pridaj aspoň jedno písmeno", "Add at least one letter"));
      return;
    }
    if (row && row.name !== trimmed) {
      renamePromStar(row.name, trimmed);
    }
    upsertPromStar(trimmed, letters);
    toast.success(tr("Uložené", "Saved"));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? tr("Upraviť hviezdu", "Edit star") : tr("Nová hviezda", "New star")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{tr("Názov hviezdy", "Star name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. AF Cyg" />
          </div>
          <div>
            <Label>{tr("Porovnávacie hviezdy", "Comparison stars")}</Label>
            <div className="space-y-2 mt-1 max-h-72 overflow-y-auto pr-1">
              {pairs.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={p.letter}
                    onChange={(e) => {
                      const next = [...pairs]; next[i] = { ...p, letter: e.target.value }; setPairs(next);
                    }}
                    placeholder="a"
                    className="w-16"
                  />
                  <Input
                    value={p.mag}
                    onChange={(e) => {
                      const next = [...pairs]; next[i] = { ...p, mag: e.target.value }; setPairs(next);
                    }}
                    placeholder="9.40"
                    inputMode="decimal"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removePair(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addPair} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" /> {tr("Pridať písmeno", "Add letter")}
            </Button>
          </div>
          <Button className="w-full" onClick={save}>
            <Save className="h-4 w-4 mr-1.5" /> {tr("Uložiť", "Save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}