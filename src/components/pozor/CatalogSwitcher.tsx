import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { CcdCatalogInfo } from "./shared";

export function CatalogSwitcher({
  catalogs,
  activeId,
  setActiveId,
  loading,
  reload,
  isOwnCatalog,
}: {
  catalogs: CcdCatalogInfo[];
  activeId: string;
  setActiveId: (id: string) => void;
  loading: boolean;
  reload: () => void;
  isOwnCatalog: boolean;
}) {
  const { t } = useI18n();
  const active = catalogs.find((c) => c.id === activeId);
  const ownCount = catalogs.filter((c) => c.user_id === active?.user_id).length;
  const [dialog, setDialog] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    if (dialog === "new") {
      const { data, error } = await supabase
        .from("ccd_catalogs")
        .insert({ name: trimmed, sort_order: catalogs.length })
        .select("id")
        .single();
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("pozor.catalog.created"));
      setDialog(null);
      reload();
      if (data) setActiveId(data.id);
    } else if (dialog === "rename" && active) {
      const { error } = await supabase.from("ccd_catalogs").update({ name: trimmed }).eq("id", active.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("pozor.catalog.renamed"));
      setDialog(null);
      reload();
    } else {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!active || !isOwnCatalog || ownCount <= 1) return;
    const { error } = await supabase.from("ccd_catalogs").delete().eq("id", active.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("pozor.catalog.deleted"));
    setActiveId("");
    reload();
  };

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">{t("pozor.catalog")}</Label>
        <Select value={activeId} onValueChange={setActiveId} disabled={loading || !catalogs.length}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {catalogs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.is_default ? ` (${t("pozor.catalog.shared")})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        onClick={() => {
          setName("");
          setDialog("new");
        }}
        title={t("pozor.catalog.new")}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        onClick={() => {
          if (!active) return;
          setName(active.name);
          setDialog("rename");
        }}
        disabled={!active || !isOwnCatalog}
        title={isOwnCatalog ? t("pozor.catalog.rename") : t("pozor.catalog.sharedHint")}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        onClick={() => setConfirmDelete(true)}
        disabled={!active || !isOwnCatalog || ownCount <= 1}
        title={isOwnCatalog ? t("pozor.catalog.delete") : t("pozor.catalog.sharedHint")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === "new" ? t("pozor.catalog.new") : t("pozor.catalog.rename")}</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("pozor.catalog.namePlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t("pozor.cancel")}
            </Button>
            <Button onClick={submit} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("pozor.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pozor.catalog.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pozor.catalog.delete.desc").replace("{name}", active?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pozor.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>{t("pozor.catalog.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
