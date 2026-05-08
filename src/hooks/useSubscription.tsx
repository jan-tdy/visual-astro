import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/useAuth";

export interface SubscriptionRow {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
}

export const DEV_PLUS_EMAIL = "var@kozmos.sk";
export const DEV_PLUS_KEY = "dev_plus_override_v1";

function readDevPlusOverride(): boolean {
  try { return localStorage.getItem(DEV_PLUS_KEY) === "1"; } catch { return false; }
}

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [devOverride, setDevOverride] = useState<boolean>(readDevPlusOverride);

  useEffect(() => {
    const onChange = () => setDevOverride(readDevPlusOverride());
    window.addEventListener("storage", onChange);
    window.addEventListener("dev-plus-override-changed", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("dev-plus-override-changed", onChange as EventListener);
    };
  }, []);

  const refetch = async () => {
    if (!user) {
      setSub(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("status,price_id,current_period_end,cancel_at_period_end,stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", getStripeEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub((data as SubscriptionRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
    if (!user) return;
    const ch = supabase
      .channel(`sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const realPlusActive = !!sub && (
    (["active", "trialing", "past_due"].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) ||
    (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > new Date())
  );

  const isDevUser = user?.email?.toLowerCase() === DEV_PLUS_EMAIL;
  const isPlusActive = realPlusActive || (isDevUser && devOverride);

  return { sub, loading, isPlusActive, refetch, isDevUser, devOverride };
}