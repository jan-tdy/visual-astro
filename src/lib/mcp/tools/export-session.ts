import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";
import { buildAAVSO, buildMEDUZA, buildVSNET, type ExportRow } from "../../exporters";
import { dateToJD } from "../../astro";

export default defineTool({
  name: "export_session",
  title: "Export session",
  description:
    "Build the VSNET, AAVSO Visual or MEDUZA export text for a session, exactly as the app's export dialog does.",
  inputSchema: {
    session_id: z.string().uuid().describe("Session to export."),
    format: z.enum(["vsnet", "aavso", "meduza"]).describe("Export format."),
    obs_code: z.string().trim().min(1).max(10).optional().describe("Observer code; defaults to the profile setting."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id, format, obs_code }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: session, error } = await supabase
      .from("sessions")
      .select("id,observed_at_utc,jd")
      .eq("id", session_id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!session) return fail("Session not found.");
    const { data: obs, error: obsErr } = await supabase
      .from("observations")
      .select("a,b,pasos_a,pasos_b,limit_value,ut_time,note,row_index,stars(name,vsnet_code,aavso_code,chart_id)")
      .eq("session_id", session_id)
      .order("row_index");
    if (obsErr) return fail(obsErr.message);
    let code = obs_code?.trim();
    if (!code) {
      const { data: profile } = await supabase.from("profiles").select("obs_code").maybeSingle();
      code = profile?.obs_code ?? "DPV";
    }
    const observedAt = new Date(session.observed_at_utc);
    const rows: ExportRow[] = (obs ?? []).map((o) => {
      const star = (o as { stars?: { name?: string; vsnet_code?: string | null; aavso_code?: string | null; chart_id?: string | null } }).stars;
      return {
        a: o.a,
        b: o.b,
        pasos_a: o.pasos_a,
        pasos_b: o.pasos_b,
        limit_value: o.limit_value,
        ut_time: o.ut_time,
        note: o.note,
        star_name: star?.name ?? "",
        vsnet_code: star?.vsnet_code ?? null,
        aavso_code: star?.aavso_code ?? null,
        chart_id: star?.chart_id ?? null,
      };
    });
    const exportCtx = {
      observedAt,
      jd: session.jd != null ? Number(session.jd) : dateToJD(observedAt),
      obsCode: code,
    };
    const text =
      format === "vsnet"
        ? buildVSNET(rows, exportCtx)
        : format === "aavso"
          ? buildAAVSO(rows, exportCtx)
          : buildMEDUZA(rows, exportCtx);
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: { format, obs_code: code, rows: rows.length, text },
    };
  },
});