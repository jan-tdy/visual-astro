import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";

type SessionHit = { id: string; name: string | null; observed_at_utc: string };
type StarHit = { id: string; name: string; constellation: string };

export function GlobalSearch() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionHit[]>([]);
  const [stars, setStars] = useState<StarHit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [{ data: ss }, { data: st }] = await Promise.all([
        supabase.from("sessions").select("id,name,observed_at_utc").order("observed_at_utc", { ascending: false }).limit(50),
        supabase.from("stars").select("id,name,constellation").order("constellation").limit(500),
      ]);
      setSessions((ss ?? []) as SessionHit[]);
      setStars((st ?? []) as StarHit[]);
    })();
  }, [open, user]);

  const go = (path: string) => { setOpen(false); nav(path); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground text-xs transition-colors min-w-[180px]"
        title={t("search.placeholder")}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{t("search.placeholder")}</span>
        <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("search.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("search.empty")}</CommandEmpty>
          {sessions.length > 0 && (
            <CommandGroup heading={t("search.sessions")}>
              {sessions.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name ?? ""} ${new Date(s.observed_at_utc).toLocaleDateString()}`}
                  onSelect={() => go(`/session/${s.id}`)}
                >
                  <span className="flex-1">{s.name || t("search.untitled")}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.observed_at_utc).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {stars.length > 0 && (
            <CommandGroup heading={t("search.stars")}>
              {stars.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.constellation}`}
                  onSelect={() => go(`/catalog#${s.id}`)}
                >
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.constellation}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}