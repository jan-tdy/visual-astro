import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Check, X, Plus, Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { getPrefs } from "@/hooks/usePrefs";
import { dateToJD, filenameDate } from "@/lib/astro";
import { buildVSNET, buildAAVSO, downloadText, type ExportRow } from "@/lib/exporters";
import {
  buildStarLookup, matchObjectName, formatPragueTime, formatUtHHMM, formatDuration,
  pragueDateKey, pragueDateKeyToUtcNoon, type MatchableStar, type StarLookup,
} from "@/lib/japyscope";

type EventStatus = "pending" | "accepted" | "dismissed";

type TelescopeEvent = {
  id: string;
  object_name: string;
  started_at: string;
  ended_at: string;
  status: EventStatus;
  matched_star_id: string | null;
};

type StarRow = MatchableStar & {
  constellation: string;
  chart_id: string | null;
  sort_order: number;
  active: boolean;
};

type Draft = {
  a: string | null;
  pasos_a: number | null;
  pasos_b: number | null;
  b: string | null;
  limit_value: string | null;
  ut_time: string | null;
  note: string | null;
};

const emptyDraft = (ut_time: string): Draft => ({
  a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null, ut_time, note: null,
});

export default function JapyScope() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TelescopeEvent[]>([]);
  const [stars, setStars] = useState<StarRow[]>([]);
  const [obsCode, setObsCode] = useState("DPV");
  const [selectedKey, setSelectedKey] = useState<string>(() => pragueDateKey(new Date().toISOString()));
  const [sortMode, setSortMode] = useState<"time" | "catalog">(() => {
    try { return (localStorage.getItem("japyscope_sort") as "time" | "catalog") || "time"; } catch { return "time"; }
  });
  useEffect(() => { try { localStorage.setItem("japyscope_sort", sortMode); } catch { /* storage unavailable */ } }, [sortMode]);
  const [draftByEvent, setDraftByEvent] = useState<Record<string, Draft>>({});
  const [manualPickerFor, setManualPickerFor] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [createStarFor, setCreateStarFor] = useState<TelescopeEvent | null>(null);
  const [createStarName, setCreateStarName] = useState("");
  const [createStarConst, setCreateStarConst] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup: StarLookup = useMemo(() => buildStarLookup(stars), [stars]);
  const starById = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars]);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const [eventsResult, starsResult, profileResult] = await Promise.all([
      fetchAllRows<TelescopeEvent>((from, to) =>
        supabase
          .from("telescope_events")
          .select("id, object_name, started_at, ended_at, status, matched_star_id")
          .order("started_at", { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<StarRow>((from, to) =>
        supabase.from("stars").select("*").order("constellation").order("sort_order").range(from, to),
      ),
      supabase.from("profiles").select("obs_code").eq("user_id", user.id).maybeSingle(),
    ]);
    if (eventsResult.error) toast.error(t("japyscope.loadError"));
    setEvents(eventsResult.data ?? []);
    setStars(starsResult.data ?? []);
    if (profileResult.data) setObsCode(profileResult.data.obs_code);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [user]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, TelescopeEvent[]>();
    for (const e of events) {
      const key = pragueDateKey(e.started_at);
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [events]);

  const markedDays = useMemo(
    () => Array.from(eventsByDay.keys()).map((key) => {
      const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
      return new Date(y, m - 1, d);
    }),
    [eventsByDay],
  );

  const selectedJsDate = useMemo(() => {
    const [y, m, d] = selectedKey.split("-").map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d);
  }, [selectedKey]);

  const dayEvents = eventsByDay.get(selectedKey) ?? [];
  const pendingEvents = dayEvents
    .filter((e) => e.status === "pending")
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  const acceptedEvents = useMemo(() => {
    const rows = dayEvents.filter((e) => e.status === "accepted");
    const sortOrderOf = (e: TelescopeEvent) => {
      const star = e.matched_star_id ? starById.get(e.matched_star_id) : undefined;
      return star?.sort_order ?? Number.MAX_SAFE_INTEGER;
    };
    return rows.slice().sort((a, b) => {
      if (sortMode === "catalog") {
        const diff = sortOrderOf(a) - sortOrderOf(b);
        if (diff !== 0) return diff;
      }
      return a.ended_at.localeCompare(b.ended_at);
    });
  }, [dayEvents, sortMode, starById]);

  // Seed a local entry draft for every accepted event of the selected day that
  // doesn't have one yet (new day selected, or an event just got confirmed).
  // Nothing here is persisted to the DB until "Vytvoriť session".
  useEffect(() => {
    setDraftByEvent((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const e of acceptedEvents) {
        if (!next[e.id]) {
          next[e.id] = emptyDraft(formatUtHHMM(e.ended_at));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedEvents.map((e) => e.id).join(",")]);

  const updateDraft = (eventId: string, patch: Partial<Draft>) => {
    setDraftByEvent((prev) => ({ ...prev, [eventId]: { ...(prev[eventId] ?? emptyDraft("")), ...patch } }));
  };

  const confirmEvent = async (event: TelescopeEvent, starId: string) => {
    const { error } = await supabase
      .from("telescope_events")
      .update({ status: "accepted", matched_star_id: starId })
      .eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: "accepted", matched_star_id: starId } : e)));
    setManualPickerFor(null);
    setManualQuery("");
  };

  const dismissEvent = async (event: TelescopeEvent) => {
    const { error } = await supabase.from("telescope_events").update({ status: "dismissed" }).eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: "dismissed" } : e)));
  };

  const openCreateStar = (event: TelescopeEvent) => {
    setCreateStarFor(event);
    setCreateStarName(event.object_name.trim());
    setCreateStarConst("");
  };

  const submitCreateStar = async () => {
    if (!user || !createStarFor) return;
    if (!createStarName.trim() || !createStarConst.trim()) {
      toast.error(t("japyscope.createStarDialog.name") + " / " + t("japyscope.createStarDialog.constellation"));
      return;
    }
    setBusy(true);
    const maxOrder = Math.max(0, ...stars.map((s) => s.sort_order));
    const { data, error } = await supabase
      .from("stars")
      .insert({
        user_id: user.id,
        name: createStarName.trim(),
        constellation: createStarConst.trim(),
        type: "VISUAL",
        sort_order: maxOrder + 1,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? t("japyscope.loadError")); return; }
    setStars((prev) => [...prev, data as StarRow]);
    await confirmEvent(createStarFor, (data as StarRow).id);
    setCreateStarFor(null);
  };

  const manualMatches = (query: string): StarRow[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stars.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.vsnet_code?.toLowerCase().includes(q) ?? false) ||
      (s.aavso_code?.toLowerCase().includes(q) ?? false)
    ).slice(0, 8);
  };

  // ------- Export (same formats/columns as elsewhere, scoped to this day) -------
  const buildDayExportRows = (): ExportRow[] => {
    const rows: ExportRow[] = [];
    for (const e of acceptedEvents) {
      if (!e.matched_star_id) continue;
      const star = starById.get(e.matched_star_id);
      const d = draftByEvent[e.id];
      if (!star || !d || !d.ut_time || !d.ut_time.trim()) continue;
      rows.push({
        star_name: star.name, vsnet_code: star.vsnet_code, aavso_code: star.aavso_code, chart_id: star.chart_id,
        a: d.a, pasos_a: d.pasos_a, pasos_b: d.pasos_b, b: d.b, limit_value: d.limit_value, note: d.note, ut_time: d.ut_time,
      });
    }
    return rows;
  };

  const exportCtx = () => {
    const observedAt = pragueDateKeyToUtcNoon(selectedKey);
    return { observedAt, jd: dateToJD(observedAt), obsCode, compLabelThreshold: getPrefs().compLabelThreshold };
  };

  const exportFile = (kind: "vsnet" | "aavso") => {
    const rows = buildDayExportRows();
    const ctx = exportCtx();
    const { text, skipped } = kind === "vsnet" ? buildVSNET(rows, ctx) : buildAAVSO(rows, ctx);
    const filename = `${kind}_${filenameDate(ctx.observedAt)}.txt`;
    downloadText(filename, text);
    if (skipped.length) toast.warning(t("editor.exportSkipped").replace("{n}", String(skipped.length)));
  };

  // ------- Create session from this day's draft -------
  const createSession = async () => {
    if (!user) return;
    const rows = buildDayExportRows();
    const withStar = acceptedEvents
      .filter((e) => e.matched_star_id && draftByEvent[e.id]?.ut_time?.trim())
      .map((e) => ({ event: e, draft: draftByEvent[e.id] }));
    if (withStar.length === 0 || rows.length === 0) {
      toast.error(t("japyscope.createSession.empty"));
      return;
    }
    setBusy(true);
    const observedAt = pragueDateKeyToUtcNoon(selectedKey);
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, observed_at_utc: observedAt.toISOString(), jd: dateToJD(observedAt) })
      .select()
      .single();
    if (error || !created) {
      setBusy(false);
      toast.error(error?.message ?? t("japyscope.loadError"));
      return;
    }
    const obsRows = withStar.map(({ event, draft }) => ({
      session_id: created.id,
      user_id: user.id,
      star_id: event.matched_star_id!,
      a: draft.a, pasos_a: draft.pasos_a, pasos_b: draft.pasos_b, b: draft.b,
      limit_value: draft.limit_value, ut_time: draft.ut_time, note: draft.note,
      row_index: 0,
    }));
    const { error: obsErr } = await supabase.from("observations").insert(obsRows);
    setBusy(false);
    if (obsErr) { toast.error(obsErr.message); return; }
    toast.success(t("japyscope.createSession.done"));
    nav(`/session/${created.id}`);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6">{t("japyscope.title")}</h1>
        <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
          <Card className="p-3 w-fit">
            <Calendar
              mode="single"
              selected={selectedJsDate}
              onSelect={(d) => d && setSelectedKey(pragueDateKey(d.toISOString()))}
              modifiers={{ hasEvents: markedDays }}
              modifiersClassNames={{
                hasEvents: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary",
              }}
            />
            <p className="text-xs text-muted-foreground px-2 pb-1">{t("japyscope.calendarHint")}</p>
          </Card>

          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">{t("japyscope.pending.title")}</h2>
              {pendingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("japyscope.pending.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {pendingEvents.map((e) => {
                    const suggestion = matchObjectName(e.object_name, lookup);
                    return (
                      <div key={e.id} className="flex flex-wrap items-center gap-2 border rounded-md p-3">
                        <div className="flex-1 min-w-[180px]">
                          <div className="font-medium">{e.object_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDuration(e.started_at, e.ended_at)} · {formatPragueTime(e.ended_at)}
                          </div>
                        </div>
                        {suggestion ? (
                          <Button size="sm" onClick={() => confirmEvent(e, suggestion.id)}>
                            <Check className="h-4 w-4 mr-1" />
                            {t("japyscope.pending.confirm")}: {suggestion.name}
                          </Button>
                        ) : (
                          <Badge variant="outline">{t("japyscope.pending.unmatched")}</Badge>
                        )}
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setManualPickerFor(manualPickerFor === e.id ? null : e.id); setManualQuery(""); }}
                        >
                          {t("japyscope.table.star")}…
                        </Button>
                        {!suggestion && (
                          <Button size="sm" variant="outline" onClick={() => openCreateStar(e)}>
                            <Plus className="h-4 w-4 mr-1" />
                            {t("japyscope.pending.createStar")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => dismissEvent(e)}>
                          <X className="h-4 w-4 mr-1" />
                          {t("japyscope.pending.dismiss")}
                        </Button>
                        {manualPickerFor === e.id && (
                          <div className="w-full">
                            <Input
                              autoFocus
                              placeholder={t("japyscope.table.star")}
                              value={manualQuery}
                              onChange={(ev) => setManualQuery(ev.target.value)}
                            />
                            {manualQuery.trim() && (
                              <div className="border rounded-md mt-1 divide-y">
                                {manualMatches(manualQuery).map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => confirmEvent(e, s.id)}
                                  >
                                    {s.name}
                                  </button>
                                ))}
                                {manualMatches(manualQuery).length === 0 && (
                                  <div className="px-3 py-1.5 text-sm text-muted-foreground">{t("japyscope.pending.unmatched")}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold">{t("japyscope.table.title")}</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setSortMode(sortMode === "time" ? "catalog" : "time")}
                  >
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    {sortMode === "time" ? t("japyscope.sort.time") : t("japyscope.sort.catalog")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportFile("vsnet")}>
                    <Download className="h-4 w-4 mr-1" />
                    {t("japyscope.export.vsnet")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportFile("aavso")}>
                    <Download className="h-4 w-4 mr-1" />
                    {t("japyscope.export.aavso")}
                  </Button>
                  <Button size="sm" onClick={createSession} disabled={busy}>
                    {t("japyscope.createSession")}
                  </Button>
                </div>
              </div>

              {acceptedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("japyscope.table.empty")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("japyscope.table.star")}</TableHead>
                        <TableHead>{t("japyscope.table.duration")}</TableHead>
                        <TableHead>{t("japyscope.table.localTime")}</TableHead>
                        <TableHead>{t("japyscope.table.utTime")}</TableHead>
                        <TableHead>{t("japyscope.table.a")}</TableHead>
                        <TableHead>{t("japyscope.table.pasoA")}</TableHead>
                        <TableHead>{t("japyscope.table.pasoB")}</TableHead>
                        <TableHead>{t("japyscope.table.b")}</TableHead>
                        <TableHead>{t("japyscope.table.limit")}</TableHead>
                        <TableHead>{t("japyscope.table.note")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acceptedEvents.map((e) => {
                        const star = e.matched_star_id ? starById.get(e.matched_star_id) : undefined;
                        const d = draftByEvent[e.id] ?? emptyDraft(formatUtHHMM(e.ended_at));
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium whitespace-nowrap">{star?.name ?? e.object_name}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDuration(e.started_at, e.ended_at)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatPragueTime(e.ended_at)}</TableCell>
                            <TableCell>
                              <Input className="w-20" value={d.ut_time ?? ""} onChange={(ev) => updateDraft(e.id, { ut_time: ev.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Input className="w-16" value={d.a ?? ""} onChange={(ev) => updateDraft(e.id, { a: ev.target.value || null })} />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="w-14" type="number" value={d.pasos_a ?? ""}
                                onChange={(ev) => updateDraft(e.id, { pasos_a: ev.target.value ? parseInt(ev.target.value, 10) : null })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="w-14" type="number" value={d.pasos_b ?? ""}
                                onChange={(ev) => updateDraft(e.id, { pasos_b: ev.target.value ? parseInt(ev.target.value, 10) : null })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input className="w-16" value={d.b ?? ""} onChange={(ev) => updateDraft(e.id, { b: ev.target.value || null })} />
                            </TableCell>
                            <TableCell>
                              <Input className="w-20" value={d.limit_value ?? ""} onChange={(ev) => updateDraft(e.id, { limit_value: ev.target.value || null })} />
                            </TableCell>
                            <TableCell>
                              <Input className="w-28" value={d.note ?? ""} onChange={(ev) => updateDraft(e.id, { note: ev.target.value || null })} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {acceptedEvents.length === 0 && dayEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("japyscope.noEventsDay")}</p>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={!!createStarFor} onOpenChange={(open) => !open && setCreateStarFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("japyscope.createStarDialog.title")}</DialogTitle>
            <DialogDescription>{createStarFor?.object_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newStarName">{t("japyscope.createStarDialog.name")}</Label>
              <Input id="newStarName" value={createStarName} onChange={(e) => setCreateStarName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="newStarConst">{t("japyscope.createStarDialog.constellation")}</Label>
              <Input
                id="newStarConst" value={createStarConst}
                placeholder={t("japyscope.createStarDialog.constellationPh")}
                onChange={(e) => setCreateStarConst(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateStarFor(null)}>{t("japyscope.createStarDialog.cancel")}</Button>
            <Button onClick={submitCreateStar} disabled={busy}>{t("japyscope.createStarDialog.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
