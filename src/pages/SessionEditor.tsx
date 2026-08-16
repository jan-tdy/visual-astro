import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
  import { Loader2, Download, FileText, ChevronLeft, X, Upload, FileJson, Plus, ScanLine, Printer, Search, PanelLeftClose, PanelLeftOpen, Table as TableIcon, Type, ArrowUp, ArrowDown, Sparkles, Minus, Copy } from "lucide-react";
import { toast } from "sonner";
import { computeMagnitude, dateToJD, filenameDate } from "@/lib/astro";
import { buildAAVSO, buildExportSummary, buildVSNET, downloadText, type ExportRow } from "@/lib/exporters";
import { getPrefs, SUBMISSION_PORTALS } from "@/hooks/usePrefs";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/hooks/useI18n";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import {
  buildStarMatchIndex, parseRawLine, replaceStarToken,
  replaceRawLineFields, replaceRawLineNote, type RawCorrection, type RawFields,
} from "@/lib/rawParse";
import { buildPaperTemplatePdf, type PaperTemplateLabels } from "@/lib/paperTemplatePdf";
import { splitImageIntoQuadrants } from "@/lib/imageSplit";
import {
  buildStarHistory, findOutliers,
  type HistoryObs, type HistoryOutlier, type StarHistory,
} from "@/lib/magHistory";

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
  const [starSearch, setStarSearch] = useState("");
  const [activeConst, setActiveConst] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ name: string; text: string; filename: string; kind: "vsnet" | "aavso" } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paperInputRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [ocrPhase, setOcrPhase] = useState<"scanning" | "done" | "error">("scanning");
  const [ocrLongWait, setOcrLongWait] = useState(false);
  const [ocrShowLog, setOcrShowLog] = useState(false);
  const [ocrLog, setOcrLog] = useState<string[]>([]);
  const [ocrResult, setOcrResult] = useState<{ matched: number; skipped: number } | null>(null);
  const [ocrErrorMsg, setOcrErrorMsg] = useState("");
  const ocrLongWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appendOcrLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString(undefined, { hour12: false });
    setOcrLog((prev) => [...prev, `[${ts}] ${msg}`]);
  };
  // JSON export: by default only rows with a UT time (actual observations), not every
  // touched-but-empty row — exporting everything is effectively just the star catalog.
  const [exportJsonOnlyFilled, setExportJsonOnlyFilled] = useState(true);
  const [leftAlign, setLeftAlign] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [rawMode, setRawMode] = useState(false);
  const [simpleMode, setSimpleMode] = useState<boolean>(() => {
    try { return localStorage.getItem("session_simple_mode") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("session_simple_mode", simpleMode ? "1" : "0"); } catch {} }, [simpleMode]);
  const [rawText, setRawText] = useState("");
  const [rawReport, setRawReport] = useState<{ matched: number; unmatched: string[] } | null>(null);
  // Star names the last apply rewrote. Kept in the session header rather than
  // inside the raw panel — the observer switches back to the table to check
  // them, and a warning that vanishes on the way there is no warning at all.
  const [appliedFixes, setAppliedFixes] = useState<(RawCorrection & { line: string })[]>([]);
  // Lines the last apply couldn't resolve at all. Same reasoning as
  // appliedFixes: these need to stay visible after switching back to the
  // table, not just inside the raw panel that's no longer on screen.
  const [unmatchedLines, setUnmatchedLines] = useState<string[]>([]);
  // Per-star statistics from this observer's *other* sessions, used to flag a
  // value that looks mis-transcribed (a "3" read as a "5" on the night sheet).
  const [history, setHistory] = useState<Map<string, StarHistory>>(new Map());
  const [rawPreviewSort, setRawPreviewSort] = useState<"catalog" | "ut">(() => {
    try { return (localStorage.getItem("raw_preview_sort") as any) || "catalog"; } catch { return "catalog"; }
  });
  useEffect(() => { try { localStorage.setItem("raw_preview_sort", rawPreviewSort); } catch {} }, [rawPreviewSort]);
  const [rawPreviewOrder, setRawPreviewOrder] = useState<"asc" | "desc">(() => {
    try { return (localStorage.getItem("raw_preview_order") as any) || "asc"; } catch { return "asc"; }
  });
  useEffect(() => { try { localStorage.setItem("raw_preview_order", rawPreviewOrder); } catch {} }, [rawPreviewOrder]);
  // Inline star-name edit in the raw preview table: which source line (index
  // into rawText.split) is being edited, and the current search text.
  const [rawEditingLine, setRawEditingLine] = useState<number | null>(null);
  const [rawEditQuery, setRawEditQuery] = useState("");
  // Inline edit of a single data value (A/PasoA/PasoB/B/Limit/UT/Note) in the
  // raw preview table — same idea as the star-name edit above, but keyed by
  // (line, field) since several cells on the same row can be edited.
  type RawEditField = keyof RawFields | "note";
  const [rawFieldEdit, setRawFieldEdit] = useState<{ lineIndex: number; field: RawEditField } | null>(null);
  const [rawFieldValue, setRawFieldValue] = useState("");
  // Escape cancels, but removing the focused input from the DOM can still
  // fire a blur right after — this tells that blur to skip the commit.
  const rawFieldCancelRef = useRef(false);
  const rawPrefilledRef = useRef(false);
  // Whether rawText holds observer edits that haven't been through "Apply"
  // yet. Only dirty text is worth protecting across a reload/remount — a
  // clean text is just a snapshot of the DB and should always be rebuilt
  // fresh, otherwise observations added later via the table (or by another
  // tool) stay invisible in raw mode forever, stuck behind a stale draft.
  const rawDirtyRef = useRef(false);
  const rawDraftKey = id ? `raw_draft_${id}` : "";
  const rawModeKey = id ? `raw_mode_${id}` : "";
  const rawFixesKey = id ? `raw_fixes_${id}` : "";
  const rawUnmatchedKey = id ? `raw_unmatched_${id}` : "";
  // Restore persisted draft + mode + pending corrections on mount
  // (survives refresh / net drops)
  useEffect(() => {
    if (!id) return;
    try {
      const saved = localStorage.getItem(`raw_draft_${id}`);
      if (saved != null) { setRawText(saved); rawPrefilledRef.current = true; rawDirtyRef.current = true; }
      const mode = localStorage.getItem(`raw_mode_${id}`);
      if (mode === "1") setRawMode(true);
      const fixes = localStorage.getItem(`raw_fixes_${id}`);
      if (fixes) setAppliedFixes(JSON.parse(fixes));
      const unmatched = localStorage.getItem(`raw_unmatched_${id}`);
      if (unmatched) setUnmatchedLines(JSON.parse(unmatched));
    } catch {}
  }, [id]);
  // The corrections outlive the apply that produced them: they stay until the
  // observer ticks them off, so a name rewritten last night is still flagged
  // when the session is reopened to export it.
  const rememberFixes = (fixes: (RawCorrection & { line: string })[]) => {
    setAppliedFixes(fixes);
    if (!rawFixesKey) return;
    try {
      if (fixes.length) localStorage.setItem(rawFixesKey, JSON.stringify(fixes));
      else localStorage.removeItem(rawFixesKey);
    } catch {
      // Private mode / quota: the list still shows for this visit, it just
      // won't survive a reload. Not worth interrupting the observer over.
    }
  };
  // Same idea as rememberFixes, for lines the last apply couldn't resolve at all.
  const rememberUnmatched = (lines: string[]) => {
    setUnmatchedLines(lines);
    if (!rawUnmatchedKey) return;
    try {
      if (lines.length) localStorage.setItem(rawUnmatchedKey, JSON.stringify(lines));
      else localStorage.removeItem(rawUnmatchedKey);
    } catch {
      // Private mode / quota: the list still shows for this visit, it just
      // won't survive a reload. Not worth interrupting the observer over.
    }
  };
  // Persist draft on every change
  useEffect(() => {
    if (!rawDraftKey) return;
    try {
      if (rawDirtyRef.current && rawText.trim()) localStorage.setItem(rawDraftKey, rawText);
      else localStorage.removeItem(rawDraftKey);
    } catch {}
  }, [rawText, rawDraftKey]);
  useEffect(() => {
    if (!rawModeKey) return;
    try { localStorage.setItem(rawModeKey, rawMode ? "1" : "0"); } catch {}
  }, [rawMode, rawModeKey]);
  const sessionNameRef = useRef("");
  // Snapshot obs values as loaded (baseline from template session). Použijeme na
  // upozornenie ak používateľ upravil magnitúdu, ale zabudol UT čas.
  const baselineRef = useRef<Record<string, Obs>>({});
  type ExportSort = "catalog" | "name" | "constellation" | "ut" | "aavso";
  const [exportSort, setExportSort] = useState<ExportSort>(() => {
    try { return (localStorage.getItem("export_sort") as ExportSort) || "catalog"; } catch { return "catalog"; }
  });
  useEffect(() => { try { localStorage.setItem("export_sort", exportSort); } catch {} }, [exportSort]);

  // ---- RAW MODE ----
  // Line parsing + star-name autocorrect live in @/lib/rawParse (unit-tested);
  // this component only owns the catalog index and how corrections are shown.
  const { byToken, matchIndex } = useMemo(() => {
    const norm = (x: string) => x.toLowerCase().replace(/\s+/g, "");
    const map = new Map<string, Star>();
    for (const s of stars) {
      map.set(norm(s.name), s);
      if (s.vsnet_code) map.set(norm(s.vsnet_code), s);
      if (s.aavso_code) map.set(norm(s.aavso_code), s);
    }
    return { byToken: map, matchIndex: buildStarMatchIndex(Array.from(map.keys())) };
  }, [stars]);

  /** Human-readable "typed → used" line for an autocorrected star name. */
  const describeCorrection = (c: RawCorrection) => {
    const star = byToken.get(c.to);
    return {
      from: c.from,
      to: star?.name ?? c.to,
      reason: t(`editor.raw.fix.${c.kind}`),
    };
  };

  /** Catalog stars whose name/VSNET/AAVSO code contains `query` (case-insensitive). */
  const searchStars = (query: string): Star[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stars.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.vsnet_code?.toLowerCase().includes(q) ?? false) ||
      (s.aavso_code?.toLowerCase().includes(q) ?? false)
    );
  };

  /**
   * Rewrite the star name on one raw-text line, keeping everything else on
   * that line untouched — used when the observer clicks a star name in the
   * raw preview table to fix a wrong/unrecognized match. `plusLevel` and
   * `matchLen` come from parseRawLine (0/0 when nothing matched at all, in
   * which case the new name is simply prepended).
   */
  const applyRawStarEdit = (lineIndex: number, plusLevel: number, matchLen: number, star: Star) => {
    rawDirtyRef.current = true;
    setRawText((prev) => {
      const lines = prev.split(/\r?\n/);
      const line = lines[lineIndex];
      if (line == null) return prev;
      const token = star.name.toLowerCase().replace(/\s+/g, "");
      const next = [...lines];
      next[lineIndex] = replaceStarToken(line, plusLevel, matchLen, token);
      return next.join("\n");
    });
    setRawEditingLine(null);
    setRawEditQuery("");
  };

  /**
   * Rewrite a single value (A/PasoA/PasoB/B/Limit/UT/Note) on one raw-text
   * line — used when the observer clicks a data cell (not the star name) in
   * the raw preview table. `o` is that row's already-parsed observation, so
   * only the one edited field changes; everything else on the line —
   * including the star name — is carried through unchanged.
   */
  const applyRawFieldEdit = (
    lineIndex: number, plusLevel: number, matchLen: number, o: Obs,
    field: RawEditField, rawValue: string,
  ) => {
    rawDirtyRef.current = true;
    setRawText((prev) => {
      const lines = prev.split(/\r?\n/);
      const line = lines[lineIndex];
      if (line == null) return prev;
      const next = [...lines];
      if (field === "note") {
        next[lineIndex] = replaceRawLineNote(line, rawValue);
      } else {
        const fields: RawFields = {
          a: o.a, pasos_a: o.pasos_a, pasos_b: o.pasos_b, b: o.b,
          limit_value: o.limit_value, ut_time: o.ut_time,
        };
        switch (field) {
          case "a": fields.a = formatAB(rawValue).trim() || null; break;
          case "b": fields.b = formatAB(rawValue).trim() || null; break;
          case "pasos_a":
          case "pasos_b": {
            // the compact format only has room for a single paso digit
            const digit = rawValue.replace(/\D/g, "").slice(-1);
            fields[field] = digit ? parseInt(digit, 10) : null;
            break;
          }
          case "limit_value": {
            const v = formatAB(rawValue.replace(/^</, "")).trim();
            fields.limit_value = v ? "<" + v : null;
            break;
          }
          case "ut_time":
            fields.ut_time = formatUt(rawValue) || null;
            break;
        }
        next[lineIndex] = replaceRawLineFields(line, plusLevel, matchLen, fields);
      }
      return next.join("\n");
    });
    setRawFieldEdit(null);
    setRawFieldValue("");
  };

  const applyRaw = () => {
    const lines = rawText.split(/\r?\n/);
    const unmatched: string[] = [];
    const corrections: (RawCorrection & { line: string })[] = [];
    let matched = 0;
    let prevStarId: string | null = null;
    // Sledujeme, koľko "+"-zápisov už tento apply zapísal per hviezda,
    // aby sme obchádzali stale state extraByStar.
    const extrasOffset: Record<string, number> = {};
    for (const line of lines) {
      if (!line.trim()) continue;
      const p = parseRawLine(line, matchIndex);
      if (!p) { unmatched.push(line.trim()); continue; }
      if (p.correction) corrections.push({ line: line.trim(), ...p.correction });
      const star = p.starToken ? byToken.get(p.starToken) : null;
      const plus = p.plusLevel ?? 0;
      // Ktorú hviezdu použiť
      const targetStar = star ?? (plus > 0 && prevStarId ? stars.find((s) => s.id === prevStarId) : null);
      if (!targetStar) { unmatched.push(line.trim()); continue; }
      const patch = {
        a: p.a, pasos_a: p.pasos_a, pasos_b: p.pasos_b,
        b: p.b, ut_time: p.ut_time,
        limit_value: p.limit_value ?? null,
        ...(p.note !== undefined ? { note: p.note } : {}),
      };
      if (plus === 0) {
        updateObs(targetStar.id, patch);
        prevStarId = targetStar.id;
      } else {
        // "+" = ďalšie pozorovanie tej istej hviezdy (do extraByStar)
        const existing = extraByStar[targetStar.id] ?? [];
        const used = extrasOffset[targetStar.id] ?? existing.length;
        if (used >= 5) {
          unmatched.push(line.trim() + " (max 5 extra riadkov)");
          continue;
        }
        // Pridaj prázdny riadok ak treba, potom updateni
        setExtraByStar((prev) => {
          const arr = prev[targetStar.id] ?? [];
          if (arr.length <= used) {
            const next = arr.slice();
            while (next.length <= used) {
              next.push({ star_id: targetStar.id, a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null, ut_time: null, note: null });
            }
            return { ...prev, [targetStar.id]: next };
          }
          return prev;
        });
        // Zavolaj update s krátkym oneskorením, aby state stihol updatnúť
        setTimeout(() => updateExtra(targetStar.id, used, patch as Partial<Obs>), 10);
        extrasOffset[targetStar.id] = used + 1;
      }
      matched++;
    }
    // Everything that matched is now saved to the DB, so this text is no
    // longer "unsaved work" — the next time raw mode is (re)entered it can
    // be safely rebuilt from the observations instead of restored verbatim.
    rawDirtyRef.current = false;
    setRawReport({ matched, unmatched });
    rememberFixes(corrections);
    rememberUnmatched(unmatched);
    if (matched > 0) toast.success(`Uložených ${matched} pozorovaní`);
    if (unmatched.length) toast.error(`Nerozpoznané: ${unmatched.length}`);
    // An autocorrect the observer never notices is worse than none, so it gets
    // its own toast on top of the persistent list in the report below.
    if (corrections.length) toast.warning(t("editor.raw.fixToast").replace("{n}", String(corrections.length)));
  };

  // Serialize existing observations back into raw format
  const buildRawFromObs = () => {
    const lines: string[] = [];
    const stripDot = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "");
    const nameToken = (s: Star) => (s.vsnet_code || s.name).toLowerCase().replace(/\s+/g, "");
    const utNo = (v: string | null | undefined) => (v ?? "").replace(/[^0-9]/g, "");
    const serializeObs = (name: string, o: Obs, plusPrefix = "") => {
      const pn = plusPrefix;
      const note = o.note ? "#" + o.note : "";
      // Limit-only line
      if (o.limit_value && !o.a && !o.b && o.pasos_a == null && o.pasos_b == null) {
        const lim = String(o.limit_value).replace(/^<\s*/, "");
        return `${pn}${name}<${lim}${utNo(o.ut_time)}${note}`;
      }
      const a = stripDot(o.a);
      const pa = o.pasos_a != null ? String(o.pasos_a) : "";
      const pb = o.pasos_b != null ? String(o.pasos_b) : "";
      const b = stripDot(o.b);
      const ut = utNo(o.ut_time);
      return `${pn}${name}${a}${pa}v${pb}${b}${ut}${note}`;
    };
    for (const s of stars) {
      const main = obsByStar[s.id];
      const extras = extraByStar[s.id] ?? [];
      const hasMain = main && main.ut_time && main.ut_time.trim();
      const utExtras = extras.filter((e) => e.ut_time && e.ut_time.trim());
      if (hasMain) {
        lines.push(serializeObs(nameToken(s), main));
        utExtras.forEach((e, i) => lines.push(serializeObs(nameToken(s), e, "+".repeat(i + 1))));
      } else if (utExtras.length > 0) {
        // Ak nie je main s časom, prvý extra sa berie ako hlavný záznam
        lines.push(serializeObs(nameToken(s), utExtras[0]));
        utExtras.slice(1).forEach((e, i) => lines.push(serializeObs(nameToken(s), e, "+".repeat(i + 1))));
      }
    }
    return lines.join("\n");
  };

  // Pri prepnutí do RAW módu naplň textarea existujúcimi UT riadkami.
  // A dirty draft (unsaved edits from before a reload, or mid-visit typing)
  // is kept as-is; anything else is rebuilt from the current observations
  // every time raw mode is entered, so it can never go stale relative to
  // rows added since the draft was last built (e.g. via the table).
  useEffect(() => {
    if (!rawMode) { rawPrefilledRef.current = false; return; }
    if (rawPrefilledRef.current) return;
    rawPrefilledRef.current = true;
    if (rawDirtyRef.current && rawText.trim()) return;
    const built = buildRawFromObs();
    setRawText(built.trim() ? built + "\n" : "");
    rawDirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMode]);

  // Current UT time as "HH:MM" (Plus: autofill on opening a new row).
  const nowUt = () => {
    const now = new Date();
    return `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  };
  // Helpers: auto-format UT — always strip non-digits then reinsert ":" based on length
  const formatUt = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    if (d.length === 3) return d[0] + ":" + d.slice(1);
    return d.slice(0, 2) + ":" + d.slice(2);
  };
  // Auto-format A/B comparator ("146" -> "14.6"); only insert decimal if no dot and >=3 digits
  const formatAB = (raw: string) => {
    // keep letters (comparator codes like "a","b") untouched
    if (/[^\d.,\s]/.test(raw)) return raw.trim();
    let v = raw.replace(/[^\d.,]/g, "").replace(",", ".");
    if (!v.includes(".") && /^\d+$/.test(v) && v.length >= 3) {
      v = v.slice(0, -1) + "." + v.slice(-1);
    }
    return v;
  };

  // Keyboard shortcut: "/" or Ctrl/Cmd+F focuses star search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
        return;
      }
      if (e.key === "/" && (e.target as HTMLElement) !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load session, stars, observations, profile
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      // Stars catalog paginated — PostgREST caps a single request at ~1000 rows, and a
      // growing custom catalog can exceed that, silently hiding stars past the cap otherwise.
      const [{ data: session }, starsResult, { data: obsList }, { data: profile }] =
        await Promise.all([
          supabase.from("sessions").select("*").eq("id", id).maybeSingle(),
          fetchAllRows<Star>((from, to) =>
            supabase.from("stars").select("*").order("constellation").order("sort_order").range(from, to),
          ),
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
      setStars(starsResult.data);
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
      // Uložíme kópiu pôvodných hodnôt ako baseline (deep clone stačí plytký).
      baselineRef.current = Object.fromEntries(
        Object.entries(map).map(([k, v]) => [k, { ...v }]),
      );
      if (profile) setObsCode(profile.obs_code);
      setLoading(false);
    })();
  }, [user, id, nav]);

  // Past observations of the same stars, for the "does this value look like a
  // misread digit?" check. Loaded after the session itself so it never delays
  // the editor becoming usable, and failures stay silent — the check is an
  // extra pair of eyes, not something the editor depends on.
  useEffect(() => {
    if (!user || !id || stars.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await fetchAllRows<HistoryObs & { session_id: string }>((from, to) =>
        supabase
          .from("observations")
          .select("star_id,a,b,pasos_a,pasos_b,limit_value,session_id")
          .eq("user_id", user.id)
          .neq("session_id", id)
          .range(from, to),
      );
      if (cancelled || error) return;
      const names = new Map(stars.map((s) => [s.id, s.name]));
      setHistory(buildStarHistory(data, names, getPrefs().compLabelThreshold));
    })();
    return () => { cancelled = true; };
  }, [user, id, stars]);

  // Group stars by constellation, in catalog order
  const grouped = useMemo(() => {
    const order: string[] = [];
    const m: Record<string, Star[]> = {};
    const q = starSearch.trim().toLowerCase();
    for (const s of stars) {
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
  }, [stars, starSearch]);

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
    sessionNameRef.current = sessionName;
    if (!id || loading) return;
    const t = setTimeout(() => {
      supabase
        .from("sessions")
        .update({ name: sessionName || null })
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("save name failed", error);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [id, loading, sessionName]);

  // Save name on unmount (navigation back) in case debounce didn't fire
  useEffect(() => {
    return () => {
      if (id) {
        supabase
          .from("sessions")
          .update({ name: sessionNameRef.current || null })
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("save name failed", error);
          });
      }
    };
  }, [id]);

  const saveNameNow = () => {
    if (!id) return;
    supabase
      .from("sessions")
      .update({ name: sessionName || null })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("save name failed", error);
      });
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
    }, getPrefs().autosaveDelayMs);
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
    }, getPrefs().autosaveDelayMs);
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
    const catalogIdx = new Map(stars.map((s, i) => [s.id, i] as const));
    const obsStarIds: { id: string; o: Obs }[] = [];
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
      obsStarIds.push({ id: o.star_id, o });
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
        obsStarIds.push({ id: starId, o });
      }
    }
    const utMin = (v?: string | null) => {
      const m = String(v ?? "").match(/(\d{1,2})[:.\s]+(\d{1,2})/);
      if (!m) return Number.POSITIVE_INFINITY;
      const h = parseInt(m[1]);
      const mm = parseInt(m[2]);
      // Times 0..11:59 belong to next day in observing night
      return (h < 12 ? h + 24 : h) * 60 + mm;
    };
    const decorated = rows.map((r, i) => ({ r, i, star: byId.get(obsStarIds[i]?.id ?? "") }));
    decorated.sort((A, B) => {
      switch (exportSort) {
        case "name":
          return A.r.star_name.localeCompare(B.r.star_name);
        case "constellation":
          return (A.star?.constellation ?? "").localeCompare(B.star?.constellation ?? "")
            || A.r.star_name.localeCompare(B.r.star_name);
        case "ut":
          return utMin(A.r.ut_time) - utMin(B.r.ut_time);
        case "aavso":
          return (A.r.aavso_code ?? "").localeCompare(B.r.aavso_code ?? "");
        case "catalog":
        default: {
          const ai = catalogIdx.get(obsStarIds[A.i]?.id ?? "") ?? 0;
          const bi = catalogIdx.get(obsStarIds[B.i]?.id ?? "") ?? 0;
          return ai - bi;
        }
      }
    });
    return decorated.map((d) => d.r);
  };

  const exportSummary = useMemo(
    () => buildExportSummary(buildExportRows(), { obsCode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obsByStar, extraByStar, obsCode, stars],
  );

  const exportFile = (kind: "vsnet" | "aavso", preview = false) => {
    const rows = buildExportRows();
    const ctx = { observedAt, jd, obsCode, compLabelThreshold: getPrefs().compLabelThreshold };
    let text = "", filename = "", name = "";
    if (kind === "vsnet") {
      text = buildVSNET(rows, ctx);
      filename = `vsnet_${filenameDate(observedAt)}.txt`;
      name = "VSNET";
    } else {
      text = buildAAVSO(rows, ctx);
      filename = `aavso_${filenameDate(observedAt)}.txt`;
      name = "AAVSO";
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
      .filter((o) => !exportJsonOnlyFilled || (o.ut_time && o.ut_time.trim()))
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
        const num = (v: any) => (v == null || v === "" ? null : Number.isFinite(+v) ? parseFloat(String(v)) : null);
        const patch: Partial<Obs> = {
          a: o.a != null && o.a !== "" ? String(o.a) : null,
          pasos_a: num(o.pasos_a),
          pasos_b: num(o.pasos_b),
          b: o.b != null && o.b !== "" ? String(o.b) : null,
          limit_value: o.limit_value != null && o.limit_value !== "" ? String(o.limit_value) : null,
          ut_time: o.ut_time != null && o.ut_time !== "" ? String(o.ut_time) : null,
          note: o.note != null && o.note !== "" ? String(o.note) : null,
        };
        const rowId = obsByStar[star.id]?.id ?? crypto.randomUUID();
        setObsByStar((prev) => {
          const cur = prev[star.id] ?? {
            star_id: star.id, a: null, pasos_a: null, pasos_b: null, b: null,
            limit_value: null, ut_time: null, note: null,
          };
          return { ...prev, [star.id]: { ...cur, ...patch, id: rowId, _dirty: true } };
        });
        upserts.push({
          id: rowId, session_id: id!, user_id: user!.id, star_id: star.id, ...patch,
        });
        matched++;
      }
      for (let i = 0; i < upserts.length; i += 200) {
        const chunk = upserts.slice(i, i + 200);
        // "observations" no longer has a unique constraint on (session_id, star_id) —
        // multiple observations per star are allowed via row_index — so conflicts must
        // be resolved on the primary key instead.
        const { error } = await supabase
          .from("observations")
          .upsert(chunk, { onConflict: "id" });
        if (error) {
          if (error.message.includes("Storage limit exceeded")) {
            toast.error(t("editor.storageLimit"));
          } else {
            toast.error(error.message);
          }
          return null;
        }
      }
      toast.success(
        t("editor.importDone").replace("{matched}", String(matched)) +
          (skipped ? t("editor.importSkipped").replace("{skipped}", String(skipped)) : ""),
      );
      return { matched, skipped };
    } catch (e: any) {
      toast.error(t("editor.importErr") + ": " + e.message);
      return null;
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
    setOcrBusy(true);
    setOcrDialogOpen(true);
    setOcrPhase("scanning");
    setOcrLongWait(false);
    setOcrLog([]);
    setOcrResult(null);
    setOcrErrorMsg("");
    if (ocrLongWaitTimerRef.current) clearTimeout(ocrLongWaitTimerRef.current);
    ocrLongWaitTimerRef.current = setTimeout(() => setOcrLongWait(true), 45000);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error(t("editor.ocrUnknown"));

      appendOcrLog(t("editor.ocrDialog.logStart"));
      const quadrants = await splitImageIntoQuadrants(dataUrl);
      const total = quadrants.length;

      // One paper-ocr call per crop, awaited normally. Earlier versions of
      // this went through SSE relaying and then a background job + DB
      // polling, both to survive a single AI call that took 86-140s — long
      // enough to outlive the proxy's ~90s client connection limit. That
      // duration turned out to be the model choice rather than anything
      // inherent, and paper-ocr now answers in seconds, so the plain call is
      // both the simplest and the most reliable option available.
      const runPart = async (partImage: string, part: number) => {
        appendOcrLog(t("editor.ocrDialog.logStartPart").replace("{part}", String(part)).replace("{total}", String(total)));
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paper-ocr`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ image: partImage, splitPart: part, splitTotal: total }),
        });

        const bodyText = await res.text();
        let body: any = null;
        try { body = JSON.parse(bodyText); } catch { /* handled below */ }

        if (!res.ok) throw new Error(body?.error || t("editor.ocrUnknown"));
        if (!body) throw new Error(t("editor.ocrUnknown"));

        const obsArr: any[] = Array.isArray(body.observations) ? body.observations : [];
        appendOcrLog(
          t("editor.ocrDialog.logDonePart")
            .replace("{part}", String(part)).replace("{total}", String(total)).replace("{n}", String(obsArr.length)),
        );
        return { observations: obsArr, used: body.used, lim: body.dailyLimit };
      };

      const results = [];
      for (let i = 0; i < quadrants.length; i++) {
        results.push(await runPart(quadrants[i], i + 1));
      }
      const obsArr = results.flatMap((r) => r.observations);
      const used = results.map((r) => r.used).reverse().find((v) => v !== undefined);
      const lim = results.map((r) => r.lim).reverse().find((v) => v !== undefined);

      appendOcrLog(t("editor.ocrDialog.logDone"));
      const blob = new Blob([JSON.stringify({ observations: obsArr })], { type: "application/json" });
      const result = await handleImportFile(new File([blob], "ocr.json", { type: "application/json" }));
      if (used && lim) toast.info(`${t("editor.ocrCount")}: ${used}/${lim}`);
      setOcrResult(result ?? { matched: 0, skipped: 0 });
      setOcrPhase("done");
    } catch (e: any) {
      const msg = e?.message ?? t("editor.ocrUnknown");
      appendOcrLog(t("editor.ocrDialog.logError").replace("{msg}", msg));
      setOcrErrorMsg(msg);
      setOcrPhase("error");
      toast.error(t("editor.ocrFailed") + ": " + msg);
    } finally {
      setOcrBusy(false);
      if (ocrLongWaitTimerRef.current) { clearTimeout(ocrLongWaitTimerRef.current); ocrLongWaitTimerRef.current = null; }
    }
  };

  const downloadPaperTemplate = async () => {
    // A real PDF, drawn with vector rect()/line() calls rather than an HTML
    // table handed to window.print(): browsers/printers can silently drop
    // hairline table borders under "fit to page" scaling, a real vector line
    // in the PDF itself can't be dropped that way.
    const prefs = getPrefs();
    const labels: PaperTemplateLabels = {
      title: t("editor.paperHeader"),
      dateLabel: t("editor.paperDate"),
      observerLabel: t("editor.paperObserver"),
      colNum: "#",
      colStar: t("editor.col.star"),
      colA: "A",
      colPasoA: t("editor.col.pasoA"),
      colPasoB: t("editor.col.pasoB"),
      colB: "B",
      colMag: t("editor.paperColMag"),
      colLimit: t("editor.col.limit"),
      colUt: "UT",
      colNote: t("editor.col.note"),
    };
    const doc = await buildPaperTemplatePdf(prefs.paperTemplate, labels, obsCode);
    doc.save(`pozorovaci-papier-${isoDate}.pdf`);
  };

  // Format input value for date (UTC)
  const isoDate = (() => {
    const d = observedAt;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  })();

  const compLabelThreshold = getPrefs().compLabelThreshold;

  const filledCount = Object.values(obsByStar).filter(
    (o) => {
      const s = stars.find((x) => x.id === o.star_id);
      return !!(o.ut_time && o.ut_time.trim()) && computeMagnitude(o, s?.name, compLabelThreshold).value !== null;
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
      if (computeMagnitude(o, s.name, compLabelThreshold).value === null) {
        list.push({ name: s.name, row: "" });
      }
    }
    for (const [starId, arr] of Object.entries(extraByStar)) {
      const s = byId.get(starId);
      if (!s) continue;
      arr.forEach((o, i) => {
        if (!o.ut_time || !o.ut_time.trim()) return;
        if (computeMagnitude(o, s.name, compLabelThreshold).value === null) {
          list.push({ name: s.name, row: ` (riadok ${i + 2})` });
        }
      });
    }
    return list;
  })();

  // Hviezdy kde bola upravená magnitúda (oproti baseline zo šablóny), ale
  // UT čas ešte nie je vyplnený — používateľ pravdepodobne zabudol pridať čas.
  const missingUtWarnings: { name: string }[] = (() => {
    const list: { name: string }[] = [];
    const byId = new Map(stars.map((s) => [s.id, s]));
    const norm = (v: string | number | null | undefined) =>
      v === null || v === undefined || v === "" ? "" : String(v).trim();
    const magFields: (keyof Obs)[] = ["a", "pasos_a", "pasos_b", "b", "limit_value"];
    for (const o of Object.values(obsByStar)) {
      if (o.ut_time && o.ut_time.trim()) continue;
      const s = byId.get(o.star_id);
      if (!s) continue;
      const base = baselineRef.current[o.star_id];
      const changed = magFields.some((f) => norm(o[f] as any) !== norm(base?.[f] as any));
      const hasValue = magFields.some((f) => norm(o[f] as any) !== "");
      if (changed && hasValue) list.push({ name: s.name });
    }
    return list;
  })();

  // Values that sit far from what this star has looked like in earlier
  // sessions. Purely advisory: variables vary, and a real outburst is exactly
  // the observation worth keeping — so this asks for a re-read, never a fix.
  const historyWarnings: { name: string; row: string; outliers: HistoryOutlier[] }[] = (() => {
    const prefs = getPrefs();
    if (!prefs.magCheckEnabled || history.size === 0) return [];
    const opts = { tolerance: prefs.magCheckTolerance, compLabelThreshold: prefs.compLabelThreshold };
    const list: { name: string; row: string; outliers: HistoryOutlier[] }[] = [];
    const byId = new Map(stars.map((s) => [s.id, s]));
    const check = (o: Obs, row: string) => {
      const s = byId.get(o.star_id);
      if (!s || !o.ut_time || !o.ut_time.trim()) return;
      const found = findOutliers(o, history.get(o.star_id), s.name, opts);
      if (found.length) list.push({ name: s.name, row, outliers: found });
    };
    for (const o of Object.values(obsByStar)) check(o, "");
    for (const [starId, arr] of Object.entries(extraByStar)) {
      arr.forEach((o, i) => check({ ...o, star_id: starId }, String(i + 2)));
    }
    return list;
  })();

  // Field labels reuse the table's own column headings rather than carrying a
  // second set of translations for the same six words. "A" and "B" are literal
  // here for the same reason they are in the table header: they never translate.
  const HISTORY_FIELD_LABEL: Record<HistoryOutlier["field"], string> = {
    mag: "editor.col.mag",
    a: "",
    b: "",
    pasos_a: "editor.col.pasoA",
    pasos_b: "editor.col.pasoB",
    limit: "editor.col.limit",
  };

  /** "Mag 13.45 · priemer 15.24 (14.90–15.60, 12×)" — the numbers behind the flag. */
  const describeOutlier = (x: HistoryOutlier) => {
    const key = HISTORY_FIELD_LABEL[x.field];
    const label = key ? t(key) : x.field.toUpperCase();
    return `${label} ${x.value.toFixed(2)} · ${t("editor.histAvg")} ${x.stat.mean.toFixed(2)} ` +
      `(${x.stat.min.toFixed(2)}–${x.stat.max.toFixed(2)}, ${x.stat.n}×)`;
  };

  return (
    <div className={`min-h-screen ${simpleMode ? "simple-mode relative" : ""}`}>
      {simpleMode && <div aria-hidden className="fixed inset-0 -z-10 bg-background" />}
      <AppHeader />
      <main className={leftAlign ? "pl-4 pr-4 py-6 max-w-6xl" : "container mx-auto px-4 py-6 max-w-6xl"}>
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="sm" onClick={() => nav("/")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t("editor.back")}
          </Button>
          <div className="flex items-center gap-1">
          <Button
            variant={simpleMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setSimpleMode((v) => !v)}
            title={simpleMode ? "Vypnúť Simple mód" : "Zapnúť Simple mód"}
          >
            {simpleMode ? <Sparkles className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
            {simpleMode ? "Bohatý" : "Simple"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeftAlign((v) => !v)}
            title={leftAlign ? t("editor.alignCenter") : t("editor.alignLeft")}
          >
            {leftAlign ? <PanelLeftOpen className="h-4 w-4 mr-1" /> : <PanelLeftClose className="h-4 w-4 mr-1" />}
            {leftAlign ? t("editor.alignCenter") : t("editor.alignLeft")}
          </Button>
          <Button
            variant={rawMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setRawMode((v) => !v)}
            title={t("editor.rawModeTooltip")}
          >
            {rawMode ? <TableIcon className="h-4 w-4 mr-1" /> : <Type className="h-4 w-4 mr-1" />}
            {rawMode ? t("editor.rawToggle.table") : t("editor.rawToggle.raw")}
          </Button>
          </div>
        </div>

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

          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">{t("editor.exportSummary")}</label>
            <code
              title={exportSummary}
              className="flex-1 min-w-0 truncate rounded-md border border-input bg-muted/40 px-2 py-1.5 font-mono text-xs"
            >
              {exportSummary}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(exportSummary); toast.success(t("editor.copied")); }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> {t("editor.copy")}
            </Button>
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

          {missingUtWarnings.length > 0 && (
            <div className="mt-3 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-300">
              <div className="font-semibold mb-1">
                Zadaná magnitúda bez UT času ({missingUtWarnings.length}):
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {missingUtWarnings.map((w, i) => (
                  <li key={i}><span className="font-medium">{w.name}</span></li>
                ))}
              </ul>
              <div className="mt-1.5 opacity-80">
                Doplň UT čas, inak sa tieto pozorovania nezahrnú do exportu.
              </div>
            </div>
          )}

          {appliedFixes.length > 0 && (
            <div className="mt-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold mb-1">
                  {t("editor.raw.fixTitle").replace("{n}", String(appliedFixes.length))}
                </div>
                <button
                  type="button"
                  onClick={() => rememberFixes([])}
                  title={t("editor.raw.fixDismiss")}
                  className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 hover:bg-yellow-500/20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {appliedFixes.map((f, i) => {
                  const d = describeCorrection(f);
                  return (
                    <li key={i}>
                      <code className="font-mono">{d.from}</code> → <span className="font-medium">{d.to}</span>
                      <span className="opacity-80"> ({d.reason})</span>
                      <span className="opacity-60 font-mono"> · {f.line}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-1.5 opacity-80">{t("editor.raw.fixHint")}</div>
            </div>
          )}

          {unmatchedLines.length > 0 && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold mb-1">
                  {t("editor.raw.unmatchedTitle").replace("{n}", String(unmatchedLines.length))}
                </div>
                <button
                  type="button"
                  onClick={() => rememberUnmatched([])}
                  title={t("editor.raw.unmatchedDismiss")}
                  className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 font-mono">
                {unmatchedLines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <div className="mt-1.5 opacity-80 font-sans">{t("editor.raw.unmatchedHint")}</div>
            </div>
          )}

          {historyWarnings.length > 0 && (
            <div className="mt-3 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
              <div className="font-semibold mb-1">
                {t("editor.histTitle").replace("{n}", String(historyWarnings.length))}
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {historyWarnings.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.name}</span>
                    {w.row && t("editor.warnRow").replace("{n}", w.row)}
                    {": "}
                    <span className="font-mono">{w.outliers.map(describeOutlier).join(" · ")}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 opacity-80">{t("editor.histHint")}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mr-2">
              <label className="text-xs text-muted-foreground">{t("editor.exportSort")}:</label>
              <select
                value={exportSort}
                onChange={(e) => setExportSort(e.target.value as any)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="catalog">{t("editor.sort.catalog")}</option>
                <option value="name">{t("editor.sort.name")}</option>
                <option value="constellation">{t("editor.sort.constellation")}</option>
                <option value="ut">{t("editor.sort.ut")}</option>
                <option value="aavso">{t("editor.sort.aavso")}</option>
              </select>
            </div>
            {(["vsnet", "aavso"] as const).map((k) => (
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
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-1" title={t("editor.exportJson.onlyFilledHint")}>
                <Checkbox
                  checked={exportJsonOnlyFilled}
                  onCheckedChange={(v) => setExportJsonOnlyFilled(v === true)}
                  className="h-3.5 w-3.5"
                />
                {t("editor.exportJson.onlyFilled")}
              </label>
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
        {!rawMode && (
        <Card className={`p-4 mb-4 ${simpleMode ? "bg-card" : "sticky top-[57px] z-20 backdrop-blur bg-card/80"}`}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
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
        </Card>
        )}

        {rawMode ? (
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div>
                <div className="font-semibold text-sm">{t("editor.raw.title")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("editor.raw.formatIntro")}{" "}
                  <code className="font-mono">hviezdaA{`{pasoA}`}v{`{pasoB}`}BUT</code>{" "}
                  ({t("editor.raw.eg")} <code className="font-mono">agdraf3v1g2108</code> {t("editor.raw.or")}{" "}
                  <code className="font-mono">mvlyr12-51v312-92110</code> {t("editor.raw.or")}{" "}
                  <code className="font-mono">mvlyr12.51v312.92110</code>). {t("editor.raw.decimalNote")}{" "}
                  {t("editor.raw.limitLabel")}{" "}
                  <code className="font-mono">{`hviezda<13.5{UT}`}</code>{" "}
                  ({t("editor.raw.eg")} <code className="font-mono">{`agdra<13-52108`}</code>).
                  {" "}{t("editor.raw.noteLabel")} <code className="font-mono">#</code>{" "}
                  ({t("editor.raw.eg")} <code className="font-mono">agdraf3v1g2108#hmla</code>).
                  {" "}{t("editor.raw.multiIntro")}
                  {" "}<code className="font-mono">+</code> {t("editor.raw.entry2")}
                  {" "}<code className="font-mono">++</code> {t("editor.raw.entry3")}
                  {" "}{t("editor.raw.autocorrectHint")}
                </div>
              </div>
              <Button size="sm" onClick={applyRaw} disabled={!rawText.trim()}>
                {t("editor.rawApply")} ({rawText.split(/\r?\n/).filter((l) => l.trim()).length})
              </Button>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => { rawDirtyRef.current = true; setRawText(e.target.value); }}
              spellCheck={false}
              autoFocus
              placeholder={"agdraf3v1g2108\nmvlyr12-51v312-92110\n..."}
              className="w-full min-h-[50vh] rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {rawReport && (
              <div className="mt-3 text-xs">
                <div className="text-primary">{t("editor.raw.saved")} {rawReport.matched}</div>
                {rawReport.unmatched.length > 0 && (
                  <div className="mt-1 text-destructive">
                    {t("editor.raw.unrecognized")} ({rawReport.unmatched.length}):
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 font-mono">
                      {rawReport.unmatched.slice(0, 20).map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div className="font-semibold text-sm">
                    {t("editor.rawPreview")}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t("editor.rawPreviewHint").replace("{action}", t("editor.rawApply"))}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs flex-wrap">
                    <span className="text-muted-foreground">{t("editor.rawSort")}</span>
                    <Button size="sm" variant={rawPreviewSort === "catalog" ? "default" : "outline"} className="h-6 px-2 text-xs" onClick={() => setRawPreviewSort("catalog")}>{t("editor.rawSortCatalog")}</Button>
                    <Button size="sm" variant={rawPreviewSort === "ut" ? "default" : "outline"} className="h-6 px-2 text-xs" onClick={() => setRawPreviewSort("ut")}>{t("editor.rawSortUt")}</Button>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1" onClick={() => setRawPreviewOrder((o) => (o === "asc" ? "desc" : "asc"))}>
                      {rawPreviewOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {rawPreviewOrder === "asc" ? t("editor.rawSortAsc") : t("editor.rawSortDesc")}
                    </Button>
                  </div>
                </div>
                {(() => {
                  // Live preview: parse the current raw text without touching DB.
                  const prefs = getPrefs();
                  const outlierOpts = { tolerance: prefs.magCheckTolerance, compLabelThreshold: prefs.compLabelThreshold };
                  const catalogIndex = new Map<string, number>();
                  stars.forEach((s, i) => catalogIndex.set(s.id, i));
                  type PreviewRow = {
                    key: string; name: string; o: Obs;
                    mag: ReturnType<typeof computeMagnitude>;
                    bad?: boolean; catIdx: number; order: number;
                    fix?: { from: string; to: string; reason: string };
                    outliers?: HistoryOutlier[];
                    /** source line + how to splice in a different star name (see applyRawStarEdit) */
                    lineIndex: number; plusLevel: number; matchLen: number;
                  };
                  const rows: PreviewRow[] = [];
                  const emptyObs = (): Obs => ({ star_id: "", a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null, ut_time: null, note: null });
                  let prevStar: Star | null = null;
                  const lines = rawText.split(/\r?\n/);
                  lines.forEach((line, i) => {
                    if (!line.trim()) return;
                    const p = parseRawLine(line, matchIndex);
                    if (!p) {
                      rows.push({ key: `bad-${i}`, name: line.trim(), o: emptyObs(), mag: null as any, bad: true, catIdx: Number.MAX_SAFE_INTEGER, order: i, lineIndex: i, plusLevel: 0, matchLen: 0 });
                      return;
                    }
                    const star = p.starToken ? byToken.get(p.starToken) : null;
                    const target = star ?? ((p.plusLevel ?? 0) > 0 ? prevStar : null);
                    if (!target) {
                      rows.push({ key: `bad-${i}`, name: line.trim(), o: emptyObs(), mag: null as any, bad: true, catIdx: Number.MAX_SAFE_INTEGER, order: i, lineIndex: i, plusLevel: p.plusLevel ?? 0, matchLen: p.matchLen });
                      return;
                    }
                    const o: Obs = {
                      star_id: target.id,
                      a: p.a, pasos_a: p.pasos_a, pasos_b: p.pasos_b, b: p.b,
                      limit_value: p.limit_value ?? null,
                      ut_time: p.ut_time,
                      note: p.note ?? null,
                    };
                    rows.push({
                      key: `r-${i}`, name: target.name, o,
                      mag: computeMagnitude(o, target.name, prefs.compLabelThreshold),
                      catIdx: catalogIndex.get(target.id) ?? Number.MAX_SAFE_INTEGER,
                      order: i,
                      lineIndex: i, plusLevel: p.plusLevel ?? 0, matchLen: p.matchLen,
                      fix: p.correction ? describeCorrection(p.correction) : undefined,
                      outliers: prefs.magCheckEnabled
                        ? findOutliers(o, history.get(target.id), target.name, outlierOpts)
                        : [],
                    });
                    if (!(p.plusLevel && p.plusLevel > 0) || star) prevStar = target;
                  });
                  if (rows.length === 0) {
                    return (
                      <div className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-md">
                        {t("editor.rawNoObservations")}
                      </div>
                    );
                  }
                  const sorted = [...rows].sort((a, b) => {
                    let cmp = 0;
                    if (rawPreviewSort === "ut") {
                      const at = a.o.ut_time ?? "";
                      const bt = b.o.ut_time ?? "";
                      if (at && !bt) cmp = -1;
                      else if (!at && bt) cmp = 1;
                      else if (at !== bt) cmp = at.localeCompare(bt);
                      else cmp = a.order - b.order;
                    } else {
                      if (a.catIdx !== b.catIdx) cmp = a.catIdx - b.catIdx;
                      else cmp = a.order - b.order;
                    }
                    return rawPreviewOrder === "desc" ? -cmp : cmp;
                  });
                  const fixes = sorted.filter((r) => r.fix);
                  const flagged = sorted.filter((r) => r.outliers?.length);
                  // Click-to-edit for a single data cell (A/PasoA/PasoB/B/Limit/UT/Note).
                  // Bad (unparseable) rows have nothing structured to edit — fixing the
                  // star name first (see the name cell above) is what turns them into a
                  // normal, editable row.
                  const renderFieldCell = (r: PreviewRow, field: RawEditField, display: string, extraTdClass = "") => {
                    if (r.bad) {
                      return <td className={`px-2 py-1 ${extraTdClass}`}>{display}</td>;
                    }
                    const editing = rawFieldEdit?.lineIndex === r.lineIndex && rawFieldEdit.field === field;
                    if (editing) {
                      return (
                        <td className={`px-2 py-1 ${extraTdClass}`}>
                          <input
                            autoFocus
                            value={rawFieldValue}
                            onChange={(e) => setRawFieldValue(e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                rawFieldCancelRef.current = true;
                                setRawFieldEdit(null);
                                setRawFieldValue("");
                              } else if (e.key === "Enter") {
                                applyRawFieldEdit(r.lineIndex, r.plusLevel, r.matchLen, r.o, field, rawFieldValue);
                              }
                            }}
                            onBlur={() => {
                              if (rawFieldCancelRef.current) { rawFieldCancelRef.current = false; return; }
                              applyRawFieldEdit(r.lineIndex, r.plusLevel, r.matchLen, r.o, field, rawFieldValue);
                            }}
                            className="w-full h-6 rounded border border-input bg-background px-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        className={`px-2 py-1 cursor-text hover:bg-accent/40 ${extraTdClass}`}
                        title={t("editor.raw.editValueTitle")}
                        onClick={() => {
                          setRawFieldEdit({ lineIndex: r.lineIndex, field });
                          setRawFieldValue(display);
                        }}
                      >
                        {display}
                      </td>
                    );
                  };
                  return (
                    <div className="space-y-2">
                    {fixes.length > 0 && (
                      <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
                        <div className="font-semibold">
                          {t("editor.raw.fixTitle").replace("{n}", String(fixes.length))}
                        </div>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {fixes.map((r) => (
                            <li key={r.key}>
                              <code className="font-mono">{r.fix!.from}</code> → <span className="font-medium">{r.fix!.to}</span>
                              <span className="opacity-80"> ({r.fix!.reason})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {flagged.length > 0 && (
                      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-2 text-xs text-sky-700 dark:text-sky-300">
                        <div className="font-semibold">
                          {t("editor.histTitle").replace("{n}", String(flagged.length))}
                        </div>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {flagged.map((r) => (
                            <li key={r.key}>
                              <span className="font-medium">{r.name}</span>{": "}
                              <span className="font-mono">{r.outliers!.map(describeOutlier).join(" · ")}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-1 opacity-80">{t("editor.histHint")}</div>
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/40 text-left">
                          <tr className="whitespace-nowrap">
                            <th className="px-2 py-1">{t("editor.col.star")}</th>
                            <th className="px-2 py-1 w-12">A</th>
                            <th className="px-2 py-1 w-10">{t("editor.col.pasoA")}</th>
                            <th className="px-2 py-1 w-10">{t("editor.col.pasoB")}</th>
                            <th className="px-2 py-1 w-12">B</th>
                            <th className="px-2 py-1 w-14">&lt;/=</th>
                            <th className="px-2 py-1 w-14">{t("editor.col.ut")}</th>
                            <th className="px-2 py-1 w-14 text-right">{t("editor.col.mag")}</th>
                            <th className="px-2 py-1">{t("editor.col.note") || "Poznámka"}</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {sorted.map((r) => {
                            const magOff = r.outliers?.some((x) => x.field === "mag" || x.field === "limit");
                            return (
                            <tr key={r.key} className={`border-t border-border/40 ${r.bad ? "text-destructive" : ""}`}>
                              <td className="px-2 py-1 font-sans font-medium relative">
                                {rawEditingLine === r.lineIndex ? (
                                  <div className="relative">
                                    <input
                                      autoFocus
                                      value={rawEditQuery}
                                      onChange={(e) => setRawEditQuery(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          setRawEditingLine(null);
                                          setRawEditQuery("");
                                        } else if (e.key === "Enter") {
                                          const matches = searchStars(rawEditQuery);
                                          if (matches.length === 1) {
                                            applyRawStarEdit(r.lineIndex, r.plusLevel, r.matchLen, matches[0]);
                                          }
                                        }
                                      }}
                                      onBlur={() => {
                                        window.setTimeout(() => {
                                          setRawEditingLine((v) => (v === r.lineIndex ? null : v));
                                        }, 150);
                                      }}
                                      placeholder={t("editor.raw.editPlaceholder")}
                                      className="w-full h-6 rounded border border-input bg-background px-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    {rawEditQuery.trim() && (
                                      <div className="absolute z-30 mt-0.5 max-h-48 w-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                                        {searchStars(rawEditQuery).slice(0, 8).map((s) => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              applyRawStarEdit(r.lineIndex, r.plusLevel, r.matchLen, s);
                                            }}
                                            className="block w-full text-left px-2 py-1 text-xs font-sans hover:bg-accent"
                                          >
                                            {s.name}
                                          </button>
                                        ))}
                                        {searchStars(rawEditQuery).length === 0 && (
                                          <div className="px-2 py-1 text-xs font-sans text-muted-foreground">
                                            {t("editor.raw.editNoMatch")}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    title={t("editor.raw.editNameTitle")}
                                    onClick={() => {
                                      setRawEditingLine(r.lineIndex);
                                      setRawEditQuery(r.bad ? "" : r.name);
                                    }}
                                    className="text-left hover:underline decoration-dotted underline-offset-2"
                                  >
                                    {r.bad ? `? ${r.name}` : r.name}
                                  </button>
                                )}
                                {r.fix && rawEditingLine !== r.lineIndex && (
                                  <span
                                    className="ml-1 text-yellow-600 dark:text-yellow-400"
                                    title={`${r.fix.from} → ${r.fix.to} (${r.fix.reason})`}
                                  >
                                    ✎
                                  </span>
                                )}
                              </td>
                              {renderFieldCell(r, "a", r.o.a ?? "", r.outliers?.some((x) => x.field === "a") ? "text-sky-600 dark:text-sky-400" : "")}
                              {renderFieldCell(r, "pasos_a", r.o.pasos_a != null ? String(r.o.pasos_a) : "", r.outliers?.some((x) => x.field === "pasos_a") ? "text-sky-600 dark:text-sky-400" : "")}
                              {renderFieldCell(r, "pasos_b", r.o.pasos_b != null ? String(r.o.pasos_b) : "", r.outliers?.some((x) => x.field === "pasos_b") ? "text-sky-600 dark:text-sky-400" : "")}
                              {renderFieldCell(r, "b", r.o.b ?? "", r.outliers?.some((x) => x.field === "b") ? "text-sky-600 dark:text-sky-400" : "")}
                              {renderFieldCell(r, "limit_value", r.o.limit_value ?? "")}
                              {renderFieldCell(r, "ut_time", r.o.ut_time ?? "")}
                              <td
                                className={`px-2 py-1 text-right ${magOff ? "text-sky-600 dark:text-sky-400 font-semibold" : ""}`}
                                title={r.outliers?.length ? r.outliers.map(describeOutlier).join(" · ") : undefined}
                              >
                                {r.mag?.value ?? <span className="text-muted-foreground">—</span>}
                              </td>
                              {renderFieldCell(r, "note", r.o.note ?? "", "font-sans text-muted-foreground")}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </Card>
        ) : (
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
                      <th className="px-1 py-1.5 w-6 text-center text-muted-foreground">V</th>
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
                      const mag = computeMagnitude(o ?? { a: null, pasos_a: null, pasos_b: null, b: null, limit_value: null }, s.name, compLabelThreshold);
                      const r = flatIndex[s.id];
                      const extras = extraByStar[s.id] ?? [];
                      return (
                        <Fragment key={s.id}>
                        <tr className="border-b border-border/40 hover:bg-secondary/20">
                          <td className="px-2 py-1 font-medium sticky left-0 bg-card">{s.name}</td>
                          <td className="px-1 py-1">
                            <Input
                              data-cell={`${r}-0`}
                              onKeyDown={handleCellKey}
                              onFocus={() => {
                                if (isPlusActive && getPrefs().autofillUtNow && !o?.ut_time) {
                                  updateObs(s.id, { ut_time: nowUt() });
                                }
                              }}
                              value={o?.a ?? ""}
                              onChange={(e) => updateObs(s.id, { a: formatAB(e.target.value) || null })}
                              className="h-7 text-xs rounded-sm"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-1`} onKeyDown={handleCellKey} type="number" step={1} min={0} value={o?.pasos_a ?? ""} onChange={(e) => updateObs(s.id, { pasos_a: e.target.value === "" ? null : parseInt(e.target.value, 10) })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1 text-center text-xs text-muted-foreground font-semibold">V</td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-2`} onKeyDown={handleCellKey} type="number" step={1} min={0} value={o?.pasos_b ?? ""} onChange={(e) => updateObs(s.id, { pasos_b: e.target.value === "" ? null : parseInt(e.target.value, 10) })} className="h-7 text-xs rounded-sm" />
                          </td>
                          <td className="px-1 py-1">
                            <Input data-cell={`${r}-3`} onKeyDown={handleCellKey} value={o?.b ?? ""} onChange={(e) => updateObs(s.id, { b: formatAB(e.target.value) || null })} className="h-7 text-xs rounded-sm" />
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
                                const v = formatUt(e.target.value);
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
                          const emag = computeMagnitude(eo, s.name, compLabelThreshold);
                          return (
                            <tr key={`${s.id}-extra-${ei}`} className="border-b border-border/40 bg-secondary/10">
                              <td className="px-2 py-1 text-muted-foreground sticky left-0 bg-card pl-6">↳ {s.name}</td>
                              <td className="px-1 py-1">
                                <Input value={eo.a ?? ""} onChange={(e) => updateExtra(s.id, ei, { a: formatAB(e.target.value) || null })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input type="number" step={1} min={0} value={eo.pasos_a ?? ""} onChange={(e) => updateExtra(s.id, ei, { pasos_a: e.target.value === "" ? null : parseInt(e.target.value, 10) })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1 text-center text-xs text-muted-foreground font-semibold">V</td>
                              <td className="px-1 py-1">
                                <Input type="number" step={1} min={0} value={eo.pasos_b ?? ""} onChange={(e) => updateExtra(s.id, ei, { pasos_b: e.target.value === "" ? null : parseInt(e.target.value, 10) })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input value={eo.b ?? ""} onChange={(e) => updateExtra(s.id, ei, { b: formatAB(e.target.value) || null })} className="h-7 text-xs rounded-sm" />
                              </td>
                              <td className="px-1 py-1">
                                <Input value={eo.limit_value ?? ""} onChange={(e) => updateExtra(s.id, ei, { limit_value: e.target.value || null })} className="h-7 text-xs rounded-sm" placeholder="<14.9" />
                              </td>
                              <td className="px-1 py-1">
                                <Input
                                  value={eo.ut_time ?? ""}
                                  onChange={(e) => updateExtra(s.id, ei, { ut_time: formatUt(e.target.value) || null })}
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
        )}
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
              aria-label={t("common.close")}
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

      <Dialog
        open={ocrDialogOpen}
        onOpenChange={(open) => {
          // Scanning still in flight: the request keeps running in the
          // background regardless, so closing here would just strand the
          // observer without a way to see the result — block it until we
          // reach "done" or "error".
          if (!open && ocrPhase === "scanning") return;
          setOcrDialogOpen(open);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => { if (ocrPhase === "scanning") e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (ocrPhase === "scanning") e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>
              {ocrPhase === "done" ? t("editor.ocrDialog.doneTitle")
                : ocrPhase === "error" ? t("editor.ocrDialog.errorTitle")
                : t("editor.ocrDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {ocrPhase === "scanning" && (
                <>
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    {t("editor.ocrDialog.wait")}
                  </span>
                  {ocrLongWait && (
                    <span className="block mt-2 text-amber-600 dark:text-amber-400">
                      {t("editor.ocrDialog.longWait")}
                    </span>
                  )}
                </>
              )}
              {ocrPhase === "done" && ocrResult && (
                <span>
                  {t("editor.importDone").replace("{matched}", String(ocrResult.matched))}
                  {ocrResult.skipped ? t("editor.importSkipped").replace("{skipped}", String(ocrResult.skipped)) : ""}
                </span>
              )}
              {ocrPhase === "error" && <span>{ocrErrorMsg}</span>}
            </DialogDescription>
          </DialogHeader>

          <div>
            <Button size="sm" variant="ghost" onClick={() => setOcrShowLog((v) => !v)}>
              {ocrShowLog ? t("editor.ocrDialog.hideLog") : t("editor.ocrDialog.showLog")}
            </Button>
            {ocrShowLog && (
              <ScrollArea className="h-32 mt-2 rounded border border-border bg-muted/40 p-2">
                {ocrLog.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{t("editor.ocrDialog.logEmpty")}</div>
                ) : (
                  <div className="text-xs font-mono space-y-0.5">
                    {ocrLog.map((line, i) => <div key={i}>{line}</div>)}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {ocrPhase !== "scanning" && (
            <DialogFooter>
              {ocrPhase === "done" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRawMode(true); setOcrDialogOpen(false); }}
                >
                  <Type className="h-3.5 w-3.5 mr-1" /> {t("editor.ocrDialog.openRaw")}
                </Button>
              )}
              <Button size="sm" onClick={() => setOcrDialogOpen(false)}>
                {t("editor.ocrDialog.close")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}