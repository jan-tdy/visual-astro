import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Download, FileText, ChevronLeft, X, Upload, FileJson } from "lucide-react";
import { toast } from "sonner";
import { computeMagnitude, dateToJD, filenameDate } from "@/lib/astro";
import { buildAAVSO, buildMEDUZA, buildVSNET, downloadText, type ExportRow } from "@/lib/exporters";
import { getPrefs, SUBMISSION_PORTALS } from "@/hooks/usePrefs";
import { useSubscription } from "@/hooks/useSubscription";

type StarType = "VISUAL" | "BINAR" | "ECL faint" | "ECL bright";
type Star = {
  id: string;
  name: string;
  constellation: string;
  type: StarType;
  vsnet_code: string | null;
  aavso_code: string | null;
  chart_id: string | null;
  sort_order: number;
};
type Obs = {
  id?: string;
  star_id: string;
  a: string | null;
  pasos_a: number | null;
  pasos_b: number | null;
  b: string | null;
  limit_value: string | null;
  ut_time: string | null;
  note: string | null;
  _dirty?: boolean;
};

const TYPE_FILTERS: (StarType | "ALL")[] = ["ALL", "VISUAL", "BINAR", "ECL faint", "ECL bright"];
const TYPE_LABEL: Record<string, string> = {
  ALL: "Všetky",
  VISUAL: "VISUAL",
  BINAR: "BINAR",
  "ECL faint": "ECL faint",
  "ECL bright": "ECL bright",
};

function constAbbrev(name: string): string {
  // Pretty short label for the constellation links (matches user image)
  const map: Record<string, string> = {
    ANDROMEDA: "AND", CASSIOPEA: "CAS", CAMELOPARDALIS: "CAM",
    "URSA MAIOR": "UMA", "URSA MAJOR": "UMA",
    HERCULES: "HER", DRACO: "DRA", CYGNUS: "CYG",
    ORION: "ORI", GEMINI: "GEM", LEO: "LEO", AQUILA: "AQL",
    SAGITTA: "SGE", PEGASUS: "PEGASUS",
    "ECLIPSANTES faint": "ECL faint", "Eclipsantes bright": "ECL bright",
    Novae: "Novae",
  };
  return map[name] ?? name;
}

export default function SessionEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const { isPlusActive } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState<Star[]>([]);
  const [obsByStar, setObsByStar] = useState<Record<string, Obs>>({});
  const [observedAt, setObservedAt] = useState<Date>(new Date());
  const [obsCode, setObsCode] = useState("DPV");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("ALL");
  const [activeConst, setActiveConst] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ name: string; text: string; filename: string } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session, stars, observations, profile
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      const [{ data: session }, { data: starList }, { data: obsList }, { data: profile }] =
        await Promise.all([
          supabase.from("sessions").select("*").eq("id", id).maybeSingle(),
          supabase.from("stars").select("*").order("constellation").order("sort_order"),
          supabase.from("observations").select("*").eq("session_id", id),
          supabase.from("profiles").select("obs_code").eq("user_id", user.id).maybeSingle(),
        ]);
      if (!session) {
        toast.error("Session neexistuje");
        nav("/");
        return;
      }
      setObservedAt(new Date(session.observed_at_utc));
      setStars((starList ?? []) as Star[]);
      const map: Record<string, Obs> = {};
      (obsList ?? []).forEach((o: any) => { map[o.star_id] = o; });
      setObsByStar(map);
      if (profile) setObsCode(profile.obs_code);
      setLoading(false);
    })();
  }, [user, id, nav]);

  // Group stars by constellation, in catalog order
  const grouped = useMemo(() => {
    const order: string[] = [];
    const m: Record<string, Star[]> = {};
    for (const s of stars) {
      if (typeFilter !== "ALL" && s.type !== typeFilter) continue;
      if (!m[s.constellation]) {
        m[s.constellation] = [];
        order.push(s.constellation);
      }
      m[s.constellation].push(s);
    }
    return { order, map: m };
  }, [stars, typeFilter]);

  // Flat ordering of stars across constellations for keyboard navigation
  const flatIndex = useMemo(() => {
    const idx: Record<string, number> = {};
    let i = 0;
    for (const c of grouped.order) for (const s of grouped.map[c]) idx[s.id] = i++;
    return idx;
  }, [grouped]);

  const handleCellKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const el = e.currentTarget;
    const cell = el.getAttribute("data-cell");
    if (!cell) return;
    const [rStr, cStr] = cell.split("-");
    const r = parseInt(rStr), c = parseInt(cStr);
    const next = e.key === "ArrowDown" ? r + 1 : r - 1;
    const target = document.querySelector<HTMLInputElement>(`input[data-cell="${next}-${c}"]`);
    if (target) {
      e.preventDefault();
      target.focus();
      target.select?.();
    }
  };

  const jd = useMemo(() => dateToJD(observedAt), [observedAt]);

  // Save header (date/jd) on change with debounce
  useEffect(() => {
    if (!id || loading) return;
    const t = setTimeout(() => {
      supabase
        .from("sessions")
        .update({ observed_at_utc: observedAt.toISOString(), jd })
        .eq("id", id);
    }, 500);
    return () => clearTimeout(t);
  }, [observedAt, jd, id, loading]);

  const updateObs = (starId: string, patch: Partial<Obs>) => {
    setObsByStar((prev) => {
      const cur = prev[starId] ?? {
        star_id: starId, a: null, pasos_a: null, pasos_b: null, b: null,
        limit_value: null, ut_time: null, note: null,
      };
      const next = { ...cur, ...patch, _dirty: true };
      // schedule save
      saveObs(starId, next);
      return { ...prev, [starId]: next };
    });
  };

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveObs = (starId: string, o: Obs) => {
    if (!user || !id) return;
    clearTimeout(saveTimers.current[starId]);
    saveTimers.current[starId] = setTimeout(async () => {
      const payload = {
        session_id: id,
        user_id: user.id,
        star_id: starId,
        a: o.a, pasos_a: o.pasos_a, pasos_b: o.pasos_b, b: o.b,
        limit_value: o.limit_value, ut_time: o.ut_time, note: o.note,
      };
      const { error } = await supabase
        .from("observations")
        .upsert(payload, { onConflict: "session_id,star_id" });
      if (error) {
        if (error.message.includes("Storage limit exceeded")) {
          toast.error("Prekročený limit úložiska. Upgraduj na Plus pre viac miesta.");
        } else {
          toast.error(error.message);
        }
      }
    }, 600);
  };

  const scrollTo = (constellation: string) => {
    setActiveConst(constellation);
    sectionRefs.current[constellation]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Predvolené súhvezdie (len Plus): po načítaní zoskroluj na zvolené súhvezdie
  useEffect(() => {
    if (loading) return;
    if (!isPlusActive) return;
    const pref = getPrefs().defaultConstellation;
    if (!pref) return;
    const target = grouped.order.find((c) => constAbbrev(c) === pref);
    if (!target) return;
    // počkaj na render sekcií
    const t = setTimeout(() => scrollTo(target), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isPlusActive, grouped.order.join("|")]);

  // ------- Exports -------
  const buildExportRows = (): ExportRow[] => {
    const byId = new Map(stars.map((s) => [s.id, s]));
    const rows: ExportRow[] = [];
    for (const o of Object.values(obsByStar)) {
      const s = byId.get(o.star_id);
      if (!s) continue;
      // Iba záznamy s vyplneným časom (UT)
      if (!o.ut_time || !o.ut_time.trim()) continue;
      rows.push({
        star_name: s.name,
        vsnet_code: s.vsnet_code,
        aavso_code: s.aavso_code,
        chart_id: s.chart_id,
        a: o.a, pasos_a: o.pasos_a, pasos_b: o.pasos_b, b: o.b,
        limit_value: o.limit_value, note: o.note, ut_time: o.ut_time,
      });
    }
    return rows;
  };

  const exportFile = (kind: "vsnet" | "aavso" | "meduza", preview = false) => {
    const rows = buildExportRows();
    const ctx = { observedAt, jd, obsCode };
    let text = "", filename = "", name = "";
    if (kind === "vsnet") {
      text = buildVSNET(rows, ctx);
      filename = `vsnet_${filenameDate(observedAt)}.txt`;
      name = "VSNET";
    } else if (kind === "aavso") {
      text = buildAAVSO(rows, ctx);
      filename = `aavso_${filenameDate(observedAt)}.txt`;
      name = "AAVSO";
    } else {
      text = buildMEDUZA(rows, ctx);
      filename = `meduza_${filenameDate(observedAt)}.txt`;
      name = "MEDUZA";
    }
    if (preview) setPreviewing({ name, text, filename });
    else {
      downloadText(filename, text);
      const prefs = getPrefs();
      if (isPlusActive && prefs.openPortalAfterExport[kind]) {
        const url = prefs.portalUrls?.[kind] || SUBMISSION_PORTALS[kind].url;
        setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), 250);
      }
    }
  };

  // ------- JSON Export / Import of full session -------
  const exportSessionJSON = () => {
    const byId = new Map(stars.map((s) => [s.id, s]));
    const observations = Object.values(obsByStar)
      .map((o) => {
        const s = byId.get(o.star_id);
        if (!s) return null;
        return {
          star_name: s.name,
          constellation: s.constellation,
          a: o.a, pasos_a: o.pasos_a, pasos_b: o.pasos_b, b: o.b,
          limit_value: o.limit_value, ut_time: o.ut_time, note: o.note,
        };
      })
      .filter(Boolean);
    const payload = {
      version: 1,
      observed_at_utc: observedAt.toISOString(),
      jd,
      obs_code: obsCode,
      observations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${filenameDate(observedAt)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const obsArr: any[] = Array.isArray(data) ? data : (data.observations ?? []);
      if (!Array.isArray(obsArr)) throw new Error("Neplatný JSON: chýba pole 'observations'");

      // Apply header (date / obs_code) if provided
      if (data && typeof data === "object" && data.observed_at_utc) {
        const d = new Date(data.observed_at_utc);
        if (!isNaN(d.getTime())) setObservedAt(d);
      }

      const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
      const byName = new Map<string, Star>();
      for (const s of stars) {
        byName.set(norm(s.name), s);
        byName.set(norm(s.name).replace(/\s+/g, ""), s);
      }

      let matched = 0, skipped = 0;
      const upserts: any[] = [];
      for (const o of obsArr) {
        const nameRaw = o?.star_name ?? o?.name ?? o?.estrella;
        if (!nameRaw) continue;
        const n = norm(String(nameRaw));
        const star = byName.get(n) ?? byName.get(n.replace(/\s+/g, ""));
        if (!star) { skipped++; continue; }
        const num = (v: any) => (v == null || v === "" ? null : Number.isFinite(+v) ? parseInt(String(v)) : null);
        const patch: Partial<Obs> = {
          a: o.a != null && o.a !== "" ? String(o.a) : null,
          pasos_a: num(o.pasos_a),
          pasos_b: num(o.pasos_b),
          b: o.b != null && o.b !== "" ? String(o.b) : null,
          limit_value: o.limit_value != null && o.limit_value !== "" ? String(o.limit_value) : null,
          ut_time: o.ut_time != null && o.ut_time !== "" ? String(o.ut_time) : null,
          note: o.note != null && o.note !== "" ? String(o.note) : null,
        };
        setObsByStar((prev) => {
          const cur = prev[star.id] ?? {
            star_id: star.id, a: null, pasos_a: null, pasos_b: null, b: null,
            limit_value: null, ut_time: null, note: null,
          };
          return { ...prev, [star.id]: { ...cur, ...patch, _dirty: true } };
        });
        upserts.push({
          session_id: id!, user_id: user!.id, star_id: star.id, ...patch,
        });
        matched++;
      }
      for (let i = 0; i < upserts.length; i += 200) {
        const chunk = upserts.slice(i, i + 200);
        const { error } = await supabase
          .from("observations")
          .upsert(chunk, { onConflict: "session_id,star_id" });
        if (error) {
          if (error.message.includes("Storage limit exceeded")) {
            toast.error("Prekročený limit úložiska. Upgraduj na Plus pre viac miesta.");
          } else {
            toast.error(error.message);
          }
          return;
        }
      }
      toast.success(
        `Importovaných ${matched} pozorovaní${skipped ? `, ${skipped} preskočených (chýbajú v katalógu)` : ""}`,
      );
    } catch (e: any) {
      toast.error("Chyba pri importe: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Format input value for datetime-local (UTC)
  const isoLocal = (() => {
    const d = observedAt;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  })();

  const filledCount = Object.values(obsByStar).filter(
    (o) => {
      const s = stars.find((x) => x.id === o.star_id);
      return !!(o.ut_time && o.ut_time.trim()) && computeMagnitude(o, s?.name).value !== null;
    },
  ).length;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => nav("/")} className="mb-3">
          <ChevronLeft className="h-4 w-4 mr-1" /> Sessions
        </Button>

        {/* Header card: datetime + JD + counters + exports */}
        <Card className="p-4 mb-4">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Dátum & čas (UT)</label>
              <Input
                type="datetime-local"
                value={isoLocal}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  // Parse as UTC
                  const [date, time] = v.split("T");
                  const [Y, M, D] = date.split("-").map(Number);
                  const [h, m] = time.split(":").map(Number);
                  setObservedAt(new Date(Date.UTC(Y, M - 1, D, h, m, 0)));
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">JD (kompletný)</label>
              <div className="font-mono text-sm py-2">{jd.toFixed(5)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Obs</label>
              <div className="font-mono text-sm py-2">{obsCode}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Vyplnené</div>
              <div className="text-2xl font-semibold text-primary">{filledCount}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {(["vsnet", "aavso", "meduza"] as const).map((k) => (
              <div key={k} className="flex gap-1">
                <Button size="sm" onClick={() => exportFile(k)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> {k.toUpperCase()}
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportFile(k, true)}>
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="ml-auto flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="secondary" onClick={exportSessionJSON}>
                <FileJson className="h-3.5 w-3.5 mr-1" /> Export JSON
              </Button>
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Import JSON
              </Button>
            </div>
          </div>
        </Card>

        {/* Constellation nav (matches user image) */}
        <Card className="p-4 mb-4 sticky top-[57px] z-20 backdrop-blur bg-card/80">
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2">
            {grouped.order.map((c) => (
              <a
                key={c}
                onClick={() => scrollTo(c)}
                className="nav-link"
                data-active={activeConst === c}
              >
                {constAbbrev(c)}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2 border-t border-border/60">
            {TYPE_FILTERS.map((t) => (
              <a
                key={t}
                onClick={() => setTypeFilter(t)}
                className="nav-link"
                data-active={typeFilter === t}
              >
                {TYPE_LABEL[t]}
              </a>
            ))}
          </div>
        </Card>

        {/* Sections per constellation */}
        <div className="space-y-6">
          {grouped.order.map((c) => (
            <div
              key={c}
              ref={(el) => { sectionRefs.current[c] = el; }}
              className="scroll-mt-40"
            >
              <h2 className="text-lg font-semibold mb-2 text-primary">{c}</h2>
              <Card className="overflow-x-auto rounded-md">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-secondary/40">
                    <tr className="text-left whitespace-nowrap">
                      <th className="px-2 py-1.5 sticky left-0 bg-secondary/60">Hviezda</th>
                      <th className="px-2 py-1.5 w-16">A</th>
                      <th className="px-2 py-1.5 w-14">Paso A</th>
                      <th className="px-2 py-1.5 w-14">Paso B</th>
                      <th className="px-2 py-1.5 w-16">B</th>
                      <th className="px-2 py-1.5 w-20">&lt;/=</th>
                      <th className="px-2 py-1.5 w-20">UT</th>
                      <th className="px-2 py-1.5">Nota</th>
                      <th className="px-2 py-1.5 w-20 text-right">Mag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map[c].map((s) => {
                      const o = obsByStar[s.id];
                      const mag = computeMagnitude(o ?? { a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null }, s.name);
                      const r = flatIndex[s.id];
                      return (
                        <tr key={s.id} className="border-b border-border/40 hover:bg-secondary/20">
                          <td className="px-2 py-1 font-medium sticky left-0 bg-card">{s.name}</td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-0`} onKeyDown={handleCellKey} value={o?.a ?? ""} onChange={(e) => updateObs(s.id, { a: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-1`} onKeyDown={handleCellKey} type="number" value={o?.pasos_a ?? ""} onChange={(e) => updateObs(s.id, { pasos_a: e.target.value === "" ? null : parseInt(e.target.value) })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-2`} onKeyDown={handleCellKey} type="number" value={o?.pasos_b ?? ""} onChange={(e) => updateObs(s.id, { pasos_b: e.target.value === "" ? null : parseInt(e.target.value) })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-3`} onKeyDown={handleCellKey} value={o?.b ?? ""} onChange={(e) => updateObs(s.id, { b: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-4`} onKeyDown={handleCellKey} value={o?.limit_value ?? ""} onChange={(e) => updateObs(s.id, { limit_value: e.target.value || null })} className="h-7 text-xs rounded-sm" placeholder="<14.9" />
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              data-cell={`${r}-5`}
                              onKeyDown={handleCellKey}
                              value={o?.ut_time ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.replace(/\s+/g, ":");
                                updateObs(s.id, { ut_time: v || null });
                              }}
                              className="h-7 text-xs rounded-sm"
                              placeholder="hh:mm"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-6`} onKeyDown={handleCellKey} value={o?.note ?? ""} onChange={(e) => updateObs(s.id, { note: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-xs">
                            {mag.value ?? <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          ))}
        </div>
      </main>

      {/* Preview overlay */}
      {previewing && (
        <div
          className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewing(null)}
        >
          <Card
            className="w-full max-w-3xl max-h-[80vh] flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewing(null)}
              aria-label="Zavrieť"
              className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <div className="font-semibold">{previewing.name}</div>
                <div className="text-xs text-muted-foreground">{previewing.filename}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewing.text); toast.success("Skopírované"); }}>
                  Kopírovať
                </Button>
                <Button size="sm" onClick={() => downloadText(previewing.filename, previewing.text)}>
                  <Download className="h-4 w-4 mr-1" /> Stiahnuť
                </Button>
              </div>
            </div>
            <pre className="p-4 overflow-auto text-xs font-mono whitespace-pre">{previewing.text}</pre>
          </Card>
        </div>
      )}
    </div>
  );
}