import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Download, FileText, ChevronLeft, X, Upload, FileJson, Plus, ScanLine, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { computeMagnitude, dateToJD, filenameDate } from "@/lib/astro";
import { buildAAVSO, buildMEDUZA, buildVSNET, downloadText, type ExportRow } from "@/lib/exporters";
import { getPrefs, SUBMISSION_PORTALS } from "@/hooks/usePrefs";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/hooks/useI18n";

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
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState<Star[]>([]);
  const [obsByStar, setObsByStar] = useState<Record<string, Obs>>({});
  // Lokálne dodatočné riadky tej istej hviezdy (max 5). Nepretrvávajú v DB,
  // ale zahŕňajú sa do exportov.
  const [extraByStar, setExtraByStar] = useState<Record<string, Obs[]>>({});
  const [observedAt, setObservedAt] = useState<Date>(new Date());
  const [sessionName, setSessionName] = useState<string>("");
  const [obsCode, setObsCode] = useState("DPV");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("ALL");
  const [starSearch, setStarSearch] = useState("");
  const [activeConst, setActiveConst] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ name: string; text: string; filename: string; kind: "vsnet" | "aavso" | "meduza" } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paperInputRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

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
        toast.error(t("editor.sessionMissing"));
        nav("/");
        return;
      }
      setObservedAt(new Date(session.observed_at_utc));
      setSessionName(session.name ?? "");
      setStars((starList ?? []) as Star[]);
      const map: Record<string, Obs> = {};
      const extras: Record<string, Obs[]> = {};
      const sorted = (obsList ?? []).slice().sort(
        (a: any, b: any) => (a.row_index ?? 0) - (b.row_index ?? 0),
      );
      for (const o of sorted) {
        if ((o.row_index ?? 0) === 0) map[o.star_id] = o;
        else {
          if (!extras[o.star_id]) extras[o.star_id] = [];
          extras[o.star_id].push(o);
        }
      }
      setObsByStar(map);
      setExtraByStar(extras);
      if (profile) setObsCode(profile.obs_code);
      setLoading(false);
    })();
  }, [user, id, nav]);

  // Group stars by constellation, in catalog order
  const grouped = useMemo(() => {
    const order: string[] = [];
    const m: Record<string, Star[]> = {};
    const q = starSearch.trim().toLowerCase();
    for (const s of stars) {
      if (typeFilter !== "ALL" && s.type !== typeFilter) continue;
      if (q) {
        const haystack = [s.name, s.constellation, s.type, s.vsnet_code, s.aavso_code, s.chart_id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      if (!m[s.constellation]) {
        m[s.constellation] = [];
        order.push(s.constellation);
      }
      m[s.constellation].push(s);
    }
    return { order, map: m };
  }, [stars, typeFilter, starSearch]);

  // Flat ordering of stars across constellations for keyboard navigation
  const flatIndex = useMemo(() => {
    const idx: Record<string, number> = {};
    let i = 0;
    for (const c of grouped.order) for (const s of grouped.map[c]) idx[s.id] = i++;
    return idx;
  }, [grouped]);

  const handleCellKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const cell = el.getAttribute("data-cell");
    if (!cell) return;
    const [rStr, cStr] = cell.split("-");
    const r = parseInt(rStr), c = parseInt(cStr);
    let nextR = r, nextC = c;
    if (e.key === "ArrowDown") nextR = r + 1;
    else if (e.key === "ArrowUp") nextR = r - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      // number inputy nevracajú selectionStart — vždy skoč na susedný stĺpec
      const isNumeric = el.type === "number";
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (!isNumeric && start !== null && end !== null) {
        const len = el.value.length;
        if (e.key === "ArrowRight") {
          if (start !== end || end < len) return;
        } else {
          if (start !== end || start > 0) return;
        }
      }
      nextC = e.key === "ArrowRight" ? c + 1 : c - 1;
    } else return;
    const target = document.querySelector<HTMLInputElement>(`input[data-cell="${nextR}-${nextC}"]`);
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
        .update({ name: sessionName || null })
        .eq("id", id);
    }, 500);
    return () => clearTimeout(t);
  }, [id, loading, sessionName]);

  const saveNameNow = () => {
    if (!id) return;
    supabase.from("sessions").update({ name: sessionName || null }).eq("id", id);
  };

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
        row_index: 0,
      };
      let error: any = null;
      if (o.id) {
        const r = await supabase.from("observations").update(payload).eq("id", o.id);
        error = r.error;
      } else {
        const r = await supabase.from("observations").insert(payload).select("id").maybeSingle();
        error = r.error;
        if (r.data?.id) {
          setObsByStar((prev) => {
            const cur = prev[starId];
            if (!cur || cur.id) return prev;
            return { ...prev, [starId]: { ...cur, id: r.data!.id } };
          });
        }
      }
      if (error) {
        if (error.message.includes("Storage limit exceeded")) {
          toast.error(t("editor.storageLimit"));
        } else {
          toast.error(error.message);
        }
      }
    }, 600);
  };

  const extraTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveExtra = (starId: string, idx: number, o: Obs) => {
    if (!user || !id) return;
    const key = `${starId}::${idx}`;
    clearTimeout(extraTimers.current[key]);
    extraTimers.current[key] = setTimeout(async () => {
      const payload = {
        session_id: id,
        user_id: user.id,
        star_id: starId,
        a: o.a, pasos_a: o.pasos_a, pasos_b: o.pasos_b, b: o.b,
        limit_value: o.limit_value, ut_time: o.ut_time, note: o.note,
        row_index: idx + 1,
      };
      let error: any = null;
      if (o.id) {
        const r = await supabase.from("observations").update(payload).eq("id", o.id);
        error = r.error;
      } else {
        const r = await supabase.from("observations").insert(payload).select("id").maybeSingle();
        error = r.error;
        if (r.data?.id) {
          setExtraByStar((prev) => {
            const arr = prev[starId] ?? [];
            if (!arr[idx] || arr[idx].id) return prev;
            const next = arr.slice();
            next[idx] = { ...next[idx], id: r.data!.id };
            return { ...prev, [starId]: next };
          });
        }
      }
      if (error) {
        if (error.message.includes("Storage limit exceeded")) {
          toast.error(t("editor.storageLimit"));
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

  const addExtraRow = (starId: string) => {
    setExtraByStar((prev) => {
      const cur = prev[starId] ?? [];
      if (cur.length >= 5) {
        toast.error(t("editor.maxExtra"));
        return prev;
      }
      return {
        ...prev,
        [starId]: [
          ...cur,
          { star_id: starId, a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null, ut_time: null, note: null },
        ],
      };
    });
  };

  const updateExtra = (starId: string, idx: number, patch: Partial<Obs>) => {
    setExtraByStar((prev) => {
      const cur = prev[starId] ?? [];
      const next = cur.slice();
      next[idx] = { ...next[idx], ...patch };
      saveExtra(starId, idx, next[idx]);
      return { ...prev, [starId]: next };
    });
  };

  const removeExtra = (starId: string, idx: number) => {
    const target = (extraByStar[starId] ?? [])[idx];
    if (target?.id) {
      supabase.from("observations").delete().eq("id", target.id).then(({ error }) => {
        if (error) toast.error(error.message);
      });
    }
    setExtraByStar((prev) => {
      const cur = prev[starId] ?? [];
      const next = cur.filter((_, i) => i !== idx);
      // Preindexovať zvyšné riadky v DB (row_index = i+1)
      next.forEach((row, i) => {
        if (row.id) {
          supabase.from("observations").update({ row_index: i + 1 }).eq("id", row.id);
        }
      });
      return { ...prev, [starId]: next };
    });
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
    for (const [starId, arr] of Object.entries(extraByStar)) {
      const s = byId.get(starId);
      if (!s) continue;
      for (const o of arr) {
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
    if (preview) setPreviewing({ name, text, filename, kind });
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
      if (!Array.isArray(obsArr)) throw new Error(t("editor.importInvalid"));

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
            toast.error(t("editor.storageLimit"));
          } else {
            toast.error(error.message);
          }
          return;
        }
      }
      toast.success(
        t("editor.importDone").replace("{matched}", String(matched)) +
          (skipped ? t("editor.importSkipped").replace("{skipped}", String(skipped)) : ""),
      );
    } catch (e: any) {
      toast.error(t("editor.importErr") + ": " + e.message);
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

  const handleOcrFile = async (file: File) => {
    try {
      setOcrBusy(true);
      toast.info(t("editor.ocrStart"));
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("paper-ocr", { body: { image: dataUrl } });
      if (error) {
        const ctx: any = (error as any).context;
        let msg = error.message;
        try {
          const body = ctx?.body ? await new Response(ctx.body).json() : null;
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const obsArr = (data as any)?.observations ?? [];
      const blob = new Blob([JSON.stringify({ observations: obsArr })], { type: "application/json" });
      await handleImportFile(new File([blob], "ocr.json", { type: "application/json" }));
      const used = (data as any)?.used;
      const lim = (data as any)?.dailyLimit;
      if (used && lim) toast.info(`${t("editor.ocrCount")}: ${used}/${lim}`);
    } catch (e: any) {
      toast.error(t("editor.ocrFailed") + ": " + (e?.message ?? t("editor.ocrUnknown")));
    } finally {
      setOcrBusy(false);
    }
  };

  const downloadPaperTemplate = () => {
    const headers = ["#", t("editor.paperColStar"), "A", t("editor.paperColPasoA"), t("editor.paperColPasoB"), "B", t("editor.paperColLimit"), "UT", t("editor.paperColNote")];
    const ROWS_PER_COL = 50;
    const TOTAL = 100;
    const renderTable = (startIdx: number) => `
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${Array.from({ length: ROWS_PER_COL }).map((_, i) => `<tr><td class="num">${startIdx + i + 1}</td>${Array.from({ length: headers.length - 1 }).map(() => `<td></td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    void TOTAL;
    const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${t("editor.paperTitle")}</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #000; margin: 0; padding: 4mm; font-size: 7pt; }
  header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2mm; border-bottom: 1px solid #000; padding-bottom: 1mm; }
  header h1 { margin: 0; font-size: 10pt; letter-spacing: 0.5px; }
  header .meta { font-size: 7pt; display: flex; gap: 4mm; align-items: center; }
  header .meta span { display: inline-block; min-width: 24mm; border-bottom: 1px solid #000; margin-left: 3px; padding: 0 3px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 0.4mm 0.6mm; font-size: 6pt; text-align: left; height: 4.7mm; }
  th { background: #eee; font-weight: 600; text-align: center; font-size: 6.5pt; padding: 0.6mm 0.4mm; }
  td.num { text-align: center; width: 5mm; background: #fafafa; color: #555; }
  th:nth-child(1), td:nth-child(1) { width: 5mm; }
  th:nth-child(2), td:nth-child(2) { width: 18%; }
  th:nth-child(9), td:nth-child(9) { width: 18%; }
  .print { position: fixed; top: 8px; right: 8px; }
  @media print { .print { display: none; } }
</style></head><body>
  <button class="print" onclick="window.print()">${t("editor.paperPrint")}</button>
  <header>
    <h1>${t("editor.paperHeader")}</h1>
    <div class="meta">${t("editor.paperDate")}<span></span> ${t("editor.paperObserver")}<span></span></div>
  </header>
  <div class="grid">
    ${renderTable(0)}
    ${renderTable(ROWS_PER_COL)}
  </div>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error(t("editor.popupBlocked")); return; }
    w.document.write(html);
    w.document.close();
  };

  // Format input value for date (UTC)
  const isoDate = (() => {
    const d = observedAt;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  })();

  const filledCount = Object.values(obsByStar).filter(
    (o) => {
      const s = stars.find((x) => x.id === o.star_id);
      return !!(o.ut_time && o.ut_time.trim()) && computeMagnitude(o, s?.name).value !== null;
    },
  ).length;

  // Hviezdy ktoré majú zadaný čas, ale magnitúda sa nedá vypočítať
  // (chýba A/B/Paso alebo limit). Nezapočítavajú sa do počtu/exportu.
  const incompleteWarnings: { name: string; row: string }[] = (() => {
    const list: { name: string; row: string }[] = [];
    const byId = new Map(stars.map((s) => [s.id, s]));
    for (const o of Object.values(obsByStar)) {
      if (!o.ut_time || !o.ut_time.trim()) continue;
      const s = byId.get(o.star_id);
      if (!s) continue;
      if (computeMagnitude(o, s.name).value === null) {
        list.push({ name: s.name, row: "" });
      }
    }
    for (const [starId, arr] of Object.entries(extraByStar)) {
      const s = byId.get(starId);
      if (!s) continue;
      arr.forEach((o, i) => {
        if (!o.ut_time || !o.ut_time.trim()) return;
        if (computeMagnitude(o, s.name).value === null) {
          list.push({ name: s.name, row: ` (riadok ${i + 2})` });
        }
      });
    }
    return list;
  })();

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => nav("/")} className="mb-3">
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("editor.back")}
        </Button>

        {/* Header card: datetime + JD + counters + exports */}
        <Card className="p-4 mb-4">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">{t("editor.name")}</label>
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onBlur={saveNameNow}
                placeholder={t("editor.namePlaceholder")}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("editor.date")}</label>
              <Input
                type="date"
                value={isoDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [Y, M, D] = v.split("-").map(Number);
                  // Anchor at 18:00 UT – pozorovacia noc; časy UT v riadkoch
                  // sa rátajú samostatne (00–11:59 → ďalší deň).
                  const d = new Date(Date.UTC(Y, M - 1, D, 18, 0, 0));
                  setObservedAt(d);
                  // Ulož okamžite (bez debounce) aby sa zmena nestratila pri rýchlej navigácii
                  if (id) {
                    supabase
                      .from("sessions")
                      .update({ observed_at_utc: d.toISOString(), jd: dateToJD(d) })
                      .eq("id", id)
                      .then(({ error }) => { if (error) toast.error(error.message); });
                  }
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("editor.jd")}</label>
              <div className="font-mono text-sm py-2">{jd.toFixed(5)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("editor.obs")}</label>
              <div className="font-mono text-sm py-2">{obsCode}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t("editor.filled")}</div>
              <div className="text-2xl font-semibold text-primary">{filledCount}</div>
            </div>
          </div>

          {incompleteWarnings.length > 0 && (
            <div className="mt-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
              <div className="font-semibold mb-1">
                {incompleteWarnings.length === 1
                  ? t("editor.warnTitleOne")
                  : t("editor.warnTitleMany").replace("{n}", String(incompleteWarnings.length))}
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {incompleteWarnings.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.name}</span>{w.row && t("editor.warnRow").replace("{n}", w.row.replace(/\D/g, ""))}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 opacity-80">
                {t("editor.warnHint")}
              </div>
            </div>
          )}

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
              <input
                ref={paperInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleOcrFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="secondary" onClick={downloadPaperTemplate}>
                <Printer className="h-3.5 w-3.5 mr-1" /> {t("editor.paperTemplate")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => paperInputRef.current?.click()} disabled={ocrBusy}>
                {ocrBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ScanLine className="h-3.5 w-3.5 mr-1" />}
                {t("editor.paperImport")}
              </Button>
              <Button size="sm" variant="secondary" onClick={exportSessionJSON}>
                <FileJson className="h-3.5 w-3.5 mr-1" /> {t("editor.exportJson")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> {t("editor.importJson")}
              </Button>
            </div>
          </div>
        </Card>

        {/* Constellation nav (matches user image) */}
        <Card className="p-4 mb-4 sticky top-[57px] z-20 backdrop-blur bg-card/80">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={starSearch}
              onChange={(e) => setStarSearch(e.target.value)}
              placeholder={t("editor.searchStars")}
              className="pl-9 h-9"
            />
          </div>
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
            {TYPE_FILTERS.map((tf) => (
              <a
                key={tf}
                onClick={() => setTypeFilter(tf)}
                className="nav-link"
                data-active={typeFilter === tf}
              >
                {tf === "ALL" ? t("editor.typeAll") : tf}
              </a>
            ))}
          </div>
        </Card>

        {/* Sections per constellation */}
        <div className="space-y-6">
          {grouped.order.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t("editor.noStarsMatch")}
            </Card>
          )}
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
                      <th className="px-2 py-1.5 sticky left-0 bg-secondary/60">{t("editor.col.star")}</th>
                      <th className="px-2 py-1.5 w-16">A</th>
                      <th className="px-2 py-1.5 w-14">{t("editor.col.pasoA")}</th>
                      <th className="px-2 py-1.5 w-14">{t("editor.col.pasoB")}</th>
                      <th className="px-2 py-1.5 w-16">B</th>
                      <th className="px-2 py-1.5 w-20">&lt;/=</th>
                      <th className="px-2 py-1.5 w-20">{t("editor.col.ut")}</th>
                      <th className="px-2 py-1.5">{t("editor.col.note")}</th>
                      <th className="px-2 py-1.5 w-20 text-right">{t("editor.col.mag")}</th>
                      <th className="px-2 py-1.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map[c].map((s) => {
                      const o = obsByStar[s.id];
                      const mag = computeMagnitude(o ?? { a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null }, s.name);
                      const r = flatIndex[s.id];
                      const extras = extraByStar[s.id] ?? [];
                      return (
                        <Fragment key={s.id}>
                        <tr className="border-b border-border/40 hover:bg-secondary/20">
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
                          <td className="px-1 py-1 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title={t("editor.addRow")}
                              onClick={() => addExtraRow(s.id)}
                              disabled={extras.length >= 5}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                        {extras.map((eo, ei) => {
                          const emag = computeMagnitude(eo, s.name);
                          return (
                            <tr key={`${s.id}-extra-${ei}`} className="border-b border-border/40 bg-secondary/10">
                              <td className="px-2 py-1 text-muted-foreground sticky left-0 bg-card pl-6">↳ {s.name}</td>
                              <td className="px-1 py-1">
                                <Input value={eo.a ?? ""} onChange={(e) => updateExtra(s.id, ei, { a: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input type="number" value={eo.pasos_a ?? ""} onChange={(e) => updateExtra(s.id, ei, { pasos_a: e.target.value === "" ? null : parseInt(e.target.value) })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input type="number" value={eo.pasos_b ?? ""} onChange={(e) => updateExtra(s.id, ei, { pasos_b: e.target.value === "" ? null : parseInt(e.target.value) })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input value={eo.b ?? ""} onChange={(e) => updateExtra(s.id, ei, { b: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input value={eo.limit_value ?? ""} onChange={(e) => updateExtra(s.id, ei, { limit_value: e.target.value || null })} className="h-7 text-xs rounded-sm" placeholder="<14.9" />
                              </td>
                              <td className="px-1 py-1">
                                <Input
                                  value={eo.ut_time ?? ""}
                                  onChange={(e) => updateExtra(s.id, ei, { ut_time: e.target.value.replace(/\s+/g, ":") || null })}
                                  className="h-7 text-xs rounded-sm"
                                  placeholder="hh:mm"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <Input value={eo.note ?? ""} onChange={(e) => updateExtra(s.id, ei, { note: e.target.value || null })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-xs">
                                {emag.value ?? <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-1 py-1 text-right">
                                 <Button variant="ghost" size="icon" className="h-6 w-6" title={t("editor.removeRow")} onClick={() => removeExtra(s.id, ei)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        </Fragment>
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
              aria-label={t("editor.close")}
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
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewing.text); toast.success(t("editor.copied")); }}>
                  {t("editor.copy")}
                </Button>
                <Button size="sm" onClick={() => {
                  downloadText(previewing.filename, previewing.text);
                  const prefs = getPrefs();
                  if (isPlusActive && prefs.openPortalAfterExport[previewing.kind]) {
                    const url = prefs.portalUrls?.[previewing.kind] || SUBMISSION_PORTALS[previewing.kind].url;
                    setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), 250);
                  }
                }}>
                  <Download className="h-4 w-4 mr-1" /> {t("editor.download")}
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