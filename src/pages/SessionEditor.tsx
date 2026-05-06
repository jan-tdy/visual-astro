import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Download, FileText, ChevronLeft, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { computeMagnitude, dateToJD, filenameDate } from "@/lib/astro";
import { buildAAVSO, buildMEDUZA, buildVSNET, downloadText, type ExportRow } from "@/lib/exporters";
import * as XLSX from "xlsx";

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
      if (error) toast.error(error.message);
    }, 600);
  };

  const scrollTo = (constellation: string) => {
    setActiveConst(constellation);
    sectionRefs.current[constellation]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        limit_value: o.limit_value, note: o.note,
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
    else downloadText(filename, text);
  };

  // ------- Import from XLSX/ODS -------
  const handleImportFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: null }) as any[][];
      // Try detect header row containing "Hviezda" or "Star"
      let headerIdx = rows.findIndex((r) =>
        r?.some((c) => typeof c === "string" && /hviezda|star|estrella/i.test(c)),
      );
      if (headerIdx < 0) headerIdx = 0;
      const header = rows[headerIdx].map((c) => (c == null ? "" : String(c).trim().toLowerCase()));
      const findCol = (...keys: string[]) =>
        header.findIndex((h) => keys.some((k) => h === k || h.includes(k)));
      const cName = findCol("hviezda", "star", "estrella");
      const cA = header.findIndex((h) => h === "a");
      const cPA = findCol("paso a", "pa");
      const cPB = findCol("paso b", "pb");
      const cB = header.findIndex((h) => h === "b");
      const cLim = findCol("</=", "<=", "limit");
      const cUT = findCol("ut", "čas", "cas", "time");
      const cNote = findCol("nota", "note", "poznám");
      if (cName < 0) {
        toast.error("Nenašiel sa stĺpec s názvom hviezdy");
        return;
      }
      const byName = new Map(stars.map((s) => [s.name.toLowerCase().trim(), s]));
      let matched = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        const nameRaw = r[cName];
        if (!nameRaw) continue;
        const name = String(nameRaw).toLowerCase().trim();
        const star = byName.get(name);
        if (!star) continue;
        const get = (idx: number) => (idx >= 0 && r[idx] != null && r[idx] !== "" ? r[idx] : null);
        const num = (v: any) => (v == null ? null : Number.isFinite(+v) ? parseInt(String(v)) : null);
        const utRaw = get(cUT);
        let ut: string | null = null;
        if (utRaw != null) {
          if (typeof utRaw === "number") {
            // Excel time fraction of a day
            const totalMin = Math.round(utRaw * 24 * 60);
            const hh = Math.floor(totalMin / 60) % 24;
            const mm = totalMin % 60;
            ut = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
          } else {
            ut = String(utRaw).trim().replace(/\s+/g, ":");
          }
        }
        const patch: Partial<Obs> = {
          a: get(cA) != null ? String(get(cA)) : null,
          pasos_a: num(get(cPA)),
          pasos_b: num(get(cPB)),
          b: get(cB) != null ? String(get(cB)) : null,
          limit_value: get(cLim) != null ? String(get(cLim)) : null,
          ut_time: ut,
          note: get(cNote) != null ? String(get(cNote)) : null,
        };
        updateObs(star.id, patch);
        matched++;
      }
      toast.success(`Importovaných ${matched} hviezd`);
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
    (o) => !!(o.ut_time && o.ut_time.trim()) && computeMagnitude(o).value !== null,
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
            <div className="ml-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.ods,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Import (.xlsx/.ods)
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
                      const mag = computeMagnitude(o ?? { a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null });
                      return (
                        <tr key={s.id} className="border-b border-border/40 hover:bg-secondary/20">
                          <td className="px-2 py-1 font-medium sticky left-0 bg-card">{s.name}</td>
                          <td className="px-1 py-1">
                            <Input value={o?.a ?? ""} onChange={(e) => updateObs(s.id, { a: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input type="number" value={o?.pasos_a ?? ""} onChange={(e) => updateObs(s.id, { pasos_a: e.target.value === "" ? null : parseInt(e.target.value) })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input type="number" value={o?.pasos_b ?? ""} onChange={(e) => updateObs(s.id, { pasos_b: e.target.value === "" ? null : parseInt(e.target.value) })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input value={o?.b ?? ""} onChange={(e) => updateObs(s.id, { b: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input value={o?.limit_value ?? ""} onChange={(e) => updateObs(s.id, { limit_value: e.target.value || null })} className="h-7 text-xs rounded-sm" placeholder="<14.9" />
                          </td>
                          <td className="px-1 py-1">
                            <Input
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
                            <Input value={o?.note ?? ""} onChange={(e) => updateObs(s.id, { note: e.target.value || null })} className="h-7 text-xs rounded-sm" />
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