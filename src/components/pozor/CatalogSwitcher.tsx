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
import { Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
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
  const { user } = useAuth();
  const { isPlusActive } = useSubscription();
  const active = catalogs.find((c) => c.id === activeId);
  const ownCount = catalogs.filter((c) => c.user_id === user?.id).length;
  const canCreateNew = isPlusActive || ownCount === 0;
  const [dialog, setDialog] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    if (loading) {
      toast.error(t("pozor.cat.err.noCatalog"));
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    if (dialog === "new" && !canCreateNew) {
      toast.error(t("pozor.catalog.plusRequired"));
      return;
    }
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
    if (loading) {
      toast.error(t("pozor.cat.err.noCatalog"));
      setConfirmDelete(false);
      return;
    }
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
        <Label className="text-xs">
          {t("pozor.catalog")}
          {loading && <Loader2 className="inline-block h-4 w-4 animate-spin ml-2 text-muted-foreground" />}
        </Label>
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
        className="h-9 w-9 relative"
        onClick={() => {
          if (loading) {
            toast.error(t("pozor.cat.err.noCatalog"));
            return;
          }
          if (!canCreateNew) {
            toast.error(t("pozor.catalog.plusRequired"));
            return;
          }
          setName("");
          setDialog("new");
        }}
        title={canCreateNew ? t("pozor.catalog.new") : t("pozor.catalog.plusRequired")}
        disabled={loading || !canCreateNew}
      >
        <Plus className="h-4 w-4" />
        {!canCreateNew && (
          <Lock className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-muted-foreground" />
        )}
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        onClick={() => {
          if (loading) {
            toast.error(t("pozor.cat.err.noCatalog"));
            return;
          }
          if (!active) return;
          setName(active.name);
          setDialog("rename");
        }}
        disabled={loading || !active || !isOwnCatalog}
        title={isOwnCatalog ? t("pozor.catalog.rename") : t("pozor.catalog.sharedHint")}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        onClick={() => setConfirmDelete(true)}
        disabled={loading || !active || !isOwnCatalog || ownCount <= 1}
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
            disabled={loading}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={loading}>
              {t("pozor.cancel")}
            </Button>
            <Button onClick={submit} disabled={busy || !name.trim() || loading}>
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
            <AlertDialogCancel disabled={loading}>{t("pozor.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={loading}>{t("pozor.catalog.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
