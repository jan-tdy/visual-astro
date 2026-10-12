import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface AuditRow {
  id: string;
  table_name: string;
  row_id: string;
  user_id: string | null;
  actor_id: string | null;
  old_data: Record<string, unknown>;
  created_at: string;
}

// Short, table-specific preview of what a deleted row contained — enough to
// recognize *which* session/observation it was without dumping raw JSON.
function describe(row: AuditRow): string {
  const d = row.old_data;
  if (row.table_name === "sessions") {
    const name = d.name as string | null;
    const date = d.observed_at_utc as string | null;
    return name ? `"${name}"` : date ? new Date(date).toLocaleDateString() : row.row_id;
  }
  if (row.table_name === "observations") {
    const ut = d.ut_time as string | null;
    const a = d.a as string | null;
    const b = d.b as string | null;
    return [ut, a && b ? `${a}/${b}` : null].filter(Boolean).join(" · ") || row.row_id;
  }
  return row.row_id;
}

export default function AuditLog() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_log")
        .select("id, table_name, row_id, user_id, actor_id, old_data, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as AuditRow[] | null) ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{t("auditLog.title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{t("auditLog.subtitle")}</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">{t("auditLog.none")}</Card>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {t(`auditLog.table.${r.table_name}` as "auditLog.table.sessions")} — {describe(r)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant={r.actor_id ? "secondary" : "destructive"}>
                  {r.actor_id ? t("auditLog.viaApp") : t("auditLog.outsideApp")}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
