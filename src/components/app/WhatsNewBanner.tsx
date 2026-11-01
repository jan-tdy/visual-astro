import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

const DISMISS_KEY = "whats_new_v2_dismissed";

/**
 * One-time "what's new" announcement for the v2.0 homepage/navigation refresh.
 * Dismissal is per-browser (localStorage), same pattern as DataLossNotice.
 */
export function WhatsNewBanner() {
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
    <Alert className="mb-6 border-primary/40 bg-primary/5 pr-10">
      <Sparkles className="h-4 w-4 text-primary" />
      <AlertTitle>{t("notice.whatsNew.title")}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>{t("notice.whatsNew.home")}</li>
          <li>{t("notice.whatsNew.nav")}</li>
          <li>{t("notice.whatsNew.japyscope")}</li>
        </ul>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        aria-label={t("notice.whatsNew.dismiss")}
        title={t("notice.whatsNew.dismiss")}
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
