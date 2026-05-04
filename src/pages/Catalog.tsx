import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
    if (!confirm("Zmazať túto hviezdu z katalógu?")) return;
    const { error } = await supabase.from("stars").delete().eq("id", id);
    if (error) toast.error(error.message);
    else reload();
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

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">Katalóg hviezd</h1>
          <div className="flex gap-2">
            <Input placeholder="Hľadať…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48" />
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
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(s.id); }}>
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
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Súhvezdie</Label>
            <Input value={form.constellation} onChange={(e) => setForm({ ...form, constellation: e.target.value })} />
          </div>
          <div>
            <Label>Typ</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(["vsnet_code", "aavso_code", "chart_id", "notes"] as const).map((k) => (
            <div key={k}>
              <Label>{k}</Label>
              <Input value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
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