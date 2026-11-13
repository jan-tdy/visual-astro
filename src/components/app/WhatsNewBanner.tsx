import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

const DISMISS_KEY = "whats_new_since_1_13_dismissed";

/**
 * One-time "what's new" announcement summarizing what's landed since v1.13.0
 * on the way to v2. Dismissal is per-browser (localStorage), same pattern as
 * DataLossNotice. The key is versioned so a content refresh (like this one)
 * resurfaces the banner even for people who dismissed an earlier version.
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
          <li>{t("notice.whatsNew.security")}</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">{t("notice.whatsNew.todo")}</p>
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
