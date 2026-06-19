import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

export default function CheckoutReturn() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  useEffect(() => {
    if (sessionId) toast.success(t("checkout.toastSuccess"));
  }, [sessionId, t]);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-12 max-w-lg">
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-semibold">{t("checkout.title")}</h1>
          <p className="text-muted-foreground">
            {sessionId
              ? t("checkout.success")
              : t("checkout.empty")}
          </p>
          <Button asChild>
            <Link to="/settings">{t("checkout.back")}</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}