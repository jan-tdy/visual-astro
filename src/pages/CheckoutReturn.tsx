import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  useEffect(() => {
    if (sessionId) toast.success("Platba prijatá. Plán Plus sa aktivuje o pár sekúnd.");
  }, [sessionId]);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-12 max-w-lg">
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-semibold">Ďakujeme!</h1>
          <p className="text-muted-foreground">
            {sessionId
              ? "Tvoja platba bola spracovaná. Plán Plus aktivujeme hneď ako Stripe potvrdí transakciu."
              : "Žiadna platba sa nenašla."}
          </p>
          <Button asChild>
            <Link to="/settings">Späť do nastavení</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}