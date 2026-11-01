import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProfileContextValue {
  displayName: string;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  displayName: "",
  refresh: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  const refresh = useCallback(async () => {
    const { data } = user
      ? await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      : await Promise.resolve({ data: null });
    setDisplayName(data?.display_name ?? "");
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <ProfileContext.Provider value={{ displayName, refresh }}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
