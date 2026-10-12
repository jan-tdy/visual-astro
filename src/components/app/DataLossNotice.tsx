import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

const DISMISS_KEY = "data_loss_notice_dismissed_v1";

/**
 * One-time notice about a historical autosave bug: some observation edits
 * made in the session editor silently never reached the database. Dismissal
 * is per-browser (localStorage), not per-account, since there's no DB flag
 * for it and this is meant to fade out once observers have seen it once.
 */
export function DataLossNotice() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
  };

  return (
    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10 pr-10">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle>{t("notice.dataLoss.title")}</AlertTitle>
      <AlertDescription>{t("notice.dataLoss.body")}</AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        aria-label={t("notice.dataLoss.dismiss")}
        title={t("notice.dataLoss.dismiss")}
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
