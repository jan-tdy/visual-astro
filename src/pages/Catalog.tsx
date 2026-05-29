import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

export default function Catalog() {
  const { user } = useAuth();
  const [stars, setStars] = useState<Star[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Star | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Star | null>(null);
  const [confirmImport, setConfirmImport] = useState<{ data: any[]; replace: boolean } | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stars")
      .select("*")
      .order("constellation")
      .order("sort_order");
    if (error) toast.error(error.message);
    else setStars((data ?? []) as Star[]);
    setLoading(false);
  };
  useEffect(() => {
    if (user) reload();
  }, [user]);

  const filtered = stars.filter((s) =>
    `${s.name} ${s.constellation} ${s.vsnet_code ?? ""} ${s.aavso_code ?? ""}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );

  const remove = async (id: string) => {
    const { error } = await supabase.from("stars").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Vymazané"); reload(); }
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
      toast.success("Uložené");
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
      toast.success("Pridané");
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
        if (!Array.isArray(parsed)) throw new Error("JSON musí obsahovať pole hviezd");
        setConfirmImport({ data: parsed, replace: false });
      } catch (e: any) {
        toast.error("Neplatný JSON: " + e.message);
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
    if (rows.length === 0) { toast.error("Žiadne platné riadky"); setConfirmImport(null); return; }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("stars").insert(rows.slice(i, i + 200));
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`Importovaných ${rows.length} hviezd`);
    setConfirmImport(null);
    reload();
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">Katalóg hviezd</h1>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Hľadať…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48" />
            <Button variant="outline" size="sm" onClick={exportJSON}>
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
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Pridať
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
                  <th className="px-3 py-2">Hviezda</th>
                  <th className="px-3 py-2">Súhvezdie</th>
                  <th className="px-3 py-2">Typ</th>
                  <th className="px-3 py-2">VSNET</th>
                  <th className="px-3 py-2">AAVSO</th>
                  <th className="px-3 py-2">Karta</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setEditing(s)}>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.constellation}</td>
                    <td className="px-3 py-2 text-xs">{s.type}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.vsnet_code}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.aavso_code}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.chart_id}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      <StarDialog
        open={!!editing || creating}
        star={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(s) => {
          if (editing) saveEdit({ ...editing, ...s });
          else createStar(s);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať hviezdu?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chceš odstrániť „{confirmDelete?.name}" z katalógu? Táto akcia sa nedá vrátiť späť.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirmDelete?.id;
                setConfirmDelete(null);
                if (id) remove(id);
              }}
            >
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmImport} onOpenChange={(o) => !o && setConfirmImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importovať katalóg?</AlertDialogTitle>
            <AlertDialogDescription>
              Súbor obsahuje {confirmImport?.data.length ?? 0} hviezd. Vyber, či ich chceš pridať k existujúcim, alebo nahradiť celý katalóg.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <Button variant="outline" onClick={() => runImport(false)}>Pridať</Button>
            <AlertDialogAction onClick={() => runImport(true)}>Nahradiť všetko</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StarDialog({
  open, star, onClose, onSave,
}: {
  open: boolean;
  star: Star | null;
  onClose: () => void;
  onSave: (s: any) => void;
}) {
  const [form, setForm] = useState({
    name: "", constellation: "", type: "VISUAL" as Star["type"],
    vsnet_code: "", aavso_code: "", chart_id: "", notes: "",
  });
  useEffect(() => {
    if (star) {
      setForm({
        name: star.name, constellation: star.constellation, type: star.type,
        vsnet_code: star.vsnet_code ?? "", aavso_code: star.aavso_code ?? "",
        chart_id: star.chart_id ?? "", notes: star.notes ?? "",
      });
    } else if (open) {
      setForm({ name: "", constellation: "", type: "VISUAL", vsnet_code: "", aavso_code: "", chart_id: "", notes: "" });
    }
  }, [star, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{star ? "Upraviť hviezdu" : "Nová hviezda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Názov</Label>
            <Input
              placeholder="napr. SS Cyg"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Označenie hviezdy (Bayer/Flamsteed alebo GCVS, napr. „SS Cyg", „V404 Cyg").
            </p>
          </div>
          <div>
            <Label>Súhvezdie</Label>
            <Input
              placeholder="napr. CYGNUS"
              value={form.constellation}
              onChange={(e) => setForm({ ...form, constellation: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Horný riadok.
            </p>
          </div>
          <div>
            <Label>Typ</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Filter – dolný riadok.
            </p>
          </div>
          {(
            [
              { k: "vsnet_code", label: "VSNET kód", ph: "napr. SS Cyg", hint: "Označenie hviezdy v databáze VSNET (vsnet-obs)." },
              { k: "aavso_code", label: "AAVSO kód", ph: "napr. 000-BCT-905", hint: "AUID identifikátor hviezdy v AAVSO (VSX)." },
              { k: "chart_id", label: "Karta (chart ID)", ph: "napr. X28469DM", hint: "Identifikátor porovnávacej karty (AAVSO VSP)." },
              { k: "notes", label: "Poznámky", ph: "napr. perióda ~50 dní, výrazné maximá", hint: "Voliteľné. Krátka poznámka k hviezde alebo pozorovaniam." },
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
            <Save className="h-4 w-4 mr-1.5" /> Uložiť
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}