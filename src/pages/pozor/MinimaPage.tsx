import { Link, useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useSubscription } from "@/hooks/useSubscription";
import { Minima } from "@/components/pozor/Minima";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorMinimaPage() {
  const { t } = useI18n();
  const { isPlusActive } = useSubscription();
  const { targets, settings, setSettings, locations } = useOutletContext<PozorOutletContext>();

  if (!isPlusActive) {
    return (
      <Card className="p-6 flex flex-col items-center text-center gap-3 py-12">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">{t("pozor.minima.plusTitle")}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{t("pozor.minima.plusDesc")}</p>
        <Button asChild>
          <Link to="/settings">{t("pozor.minima.plusCta")}</Link>
        </Button>
      </Card>
    );
  }

  return <Minima targets={targets} settings={settings} setSettings={setSettings} locations={locations} />;
}
