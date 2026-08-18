import { createContext, useContext, type ReactNode } from "react";

interface SubscriptionContextValue {
  isPlusActive: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// Subscriptions were discontinued: every signed-in observer gets the full
// feature set for free. Higher limits are arranged individually (Enterprise,
// see Settings → Plán a fakturácia).
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  return (
    <SubscriptionContext.Provider value={{ isPlusActive: true }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const c = useContext(SubscriptionContext);
  if (!c) throw new Error("useSubscription must be used within SubscriptionProvider");
  return c;
}
